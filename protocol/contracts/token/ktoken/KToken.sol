/*

    Copyright 2020 Kollateral LLC
    Copyright 2020-2021 ARM Finance LLC

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/
// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.1;

import "../CollateralizedToken.sol";
import "../../__oz__/access/Ownable.sol";
import "../../__oz__/math/SafeMath.sol";
import "../../__oz__/utils/Pausable.sol";
import "../../common/invoke/IInvocationHook.sol";
import "../../common/invoke/IInvokable.sol";

abstract contract KToken is IInvocationHook, CollateralizedToken, Ownable, Pausable {
    using SafeMath for uint256;

    event Invocation(address invokeTo, uint256 invokeValue, bytes32 invokeDataHash, uint256 underlyingAmount);
    event Reward(uint256 poolReward, uint256 platformReward, address tokenAddress);

    /* Reward (in bips) distributed to pool per transaction */
    uint256 internal _poolRewardBips;

    /* Reward (in bips) distributed to platform per transaction */
    uint256 internal _platformRewardBips;

    /* Address that collects the platform reward disbursements */
    address internal _platformVaultAddress;

    /* Helper - store called token amount for retrieval */
    address internal _currentSender;

    /* Helper - store called token amount for retrieval */
    uint256 internal _currentTokenAmount;

    /* Helper - store expected balance for currently executing transaction */
    uint256 internal _currentExpectedBalance;

    constructor() {}

    function invoke(
        address invokeTo,
        bytes calldata invokeData,
        uint256 underlyingAmount
    ) external payable nonReentrant whenNotPaused {
        require(invokeTo != address(this), "KToken: cannot invoke this contract");

        /* Record starting and expected ending balance */
        uint256 startingBalance = totalReserve().sub(payableReserveAdjustment());
        setInvocationState(msg.sender, underlyingAmount, calculateExpectedBalance(startingBalance, underlyingAmount));

        /* Transfer invocation amount of underlying token to caller's invocation address */
        require(transferUnderlying(invokeTo, underlyingAmount), "KToken: unable to transfer invocation amount");

        /* Invoke caller's function */
        IInvokable(invokeTo).execute{ value: msg.value }(invokeData);
        emit Invocation(invokeTo, msg.value, keccak256(invokeData), underlyingAmount);

        /* Verify tokens were returned with correct reward */
        require(totalReserve() == _currentExpectedBalance, "KToken: incorrect ending balance");

        /* Extract platform reward */
        uint256 platformReward = calculatePlatformReward(underlyingAmount);

        require(transferUnderlying(_platformVaultAddress, platformReward), "KToken: unable to transfer platform reward");
        emit Reward(calculatePoolReward(underlyingAmount), platformReward, underlying());

        /* Reset data for gas refund */
        setInvocationState(address(0), 0, 0);
    }

    function payableReserveAdjustment() internal virtual returns (uint256) {
        return 0;
    }

    function setInvocationState(
        address currentSender,
        uint256 currentTokenAmount,
        uint256 currentExpectedBalance
    ) internal {
        _currentSender = currentSender;
        _currentTokenAmount = currentTokenAmount;
        _currentExpectedBalance = currentExpectedBalance;
    }

    function calculatePoolReward(uint256 tokenAmount) internal view returns (uint256) {
        return tokenAmount.mul(_poolRewardBips).div(10000);
    }

    function calculatePlatformReward(uint256 tokenAmount) internal view returns (uint256) {
        return tokenAmount.mul(_platformRewardBips).div(10000);
    }

    function calculateExpectedBalance(uint256 startingBalance, uint256 tokenAmount) internal view returns (uint256) {
        return startingBalance.add(calculatePoolReward(tokenAmount)).add(calculatePlatformReward(tokenAmount));
    }

    function calculateRepaymentAmount(uint256 tokenAmount) external view returns (uint256) {
        return tokenAmount.add(calculatePoolReward(tokenAmount)).add(calculatePlatformReward(tokenAmount));
    }

    function poolReward() external view returns (uint256) {
        return _poolRewardBips;
    }

    function platformReward() external view returns (uint256) {
        return _platformRewardBips;
    }

    function platformVaultAddress() external view returns (address) {
        return _platformVaultAddress;
    }

    function isKToken() external pure returns (bool) {
        return true;
    }

    /* Helper hook for invoked transaction */
    function currentSender() external view override returns (address) {
        return _currentSender;
    }

    function currentTokenAddress() external view override returns (address) {
        return _underlying;
    }

    function currentTokenAmount() external view override returns (uint256) {
        return _currentTokenAmount;
    }

    function currentRepaymentAmount() external view override returns (uint256) {
        return _currentExpectedBalance.sub(totalReserve());
    }

    /* ADMIN FUNCTIONS */

    function setPoolReward(uint256 poolRewardBips) external onlyOwner {
        _poolRewardBips = poolRewardBips;
    }

    function setPlatformReward(uint256 platformRewardBips) external onlyOwner {
        _platformRewardBips = platformRewardBips;
    }

    function setPlatformVaultAddress(address vaultAddress) external onlyOwner {
        _platformVaultAddress = vaultAddress;
    }

    function pause() external onlyOwner whenNotPaused {
        _pause();
    }

    function unpause() external onlyOwner whenPaused {
        _unpause();
    }
}
