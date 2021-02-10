/*

    Copyright 2020 Kollateral LLC.
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

import "./__oz__/access/Ownable.sol";
import "./__oz__/math/SafeMath.sol";
import "./common/utils/BalanceCarrier.sol";
import "./common/invoke/IInvokable.sol";
import "./common/invoke/IInvoker.sol";
import "./liquidity/ILiquidityProxy.sol";

contract Invoker is BalanceCarrier, IInvoker, Ownable {
    using SafeMath for uint256;

    event Invocation(address invokeTo, uint256 invokeValue, bytes32 invokeDataHash, uint256 underlyingAmount);
    event Reward(uint256 poolReward, uint256 platformReward, address tokenAddress);

    mapping(address => address[]) internal _liquidityProxies;
    uint256 internal _poolRewardBips;
    mapping(address => address) _poolRewardAddresses;
    uint256 internal _platformRewardBips;
    address internal _platformVaultAddress;

    bool internal _scheduled;
    uint256 internal _schedulePriorTokenAmount;
    address internal _scheduleInvokeSender;
    address internal _scheduleInvokeTo;
    uint256 internal _scheduleInvokeValue;
    bytes internal _scheduleInvokeData;
    uint256 internal _scheduleIndex;
    address internal _scheduleTokenAddress;
    uint256 internal _scheduleTokenAmount;
    uint256[] internal _scheduleTokenAmounts;
    uint256 internal _scheduleRepayAmount;
    uint256[] internal _scheduleRepayAmounts;
    uint256 internal _schedulePoolReward;
    uint256 internal _schedulePlatformReward;

    constructor() BalanceCarrier(address(1)) {}

    function invoke(
        address invokeTo,
        bytes calldata invokeData,
        address tokenAddress,
        uint256 tokenAmount
    ) external payable override onlyFresh {
        require(isTokenAddressRegistered(tokenAddress), "Invoker: no liquidity for token");
        require(invokeTo != address(this), "Invoker: cannot invoke this contract");

        scheduleExecution(msg.sender, invokeTo, msg.value, invokeData, tokenAddress, tokenAmount);

        invokeNext();

        disburseReward();

        cleanSchedule();
    }

    function invokeNext() internal {
        ILiquidityProxy proxy = ILiquidityProxy(liquidityProxy(_scheduleIndex));
        proxy.borrow(_scheduleTokenAddress, _scheduleTokenAmounts[_scheduleIndex]);
    }

    function invokeCallback() external override onlyScheduled {
        _scheduleIndex++;
        if (_scheduleIndex == _scheduleTokenAmounts.length) {
            invokeFinal();
        } else {
            invokeNext();
        }
    }

    function invokeFinal() internal {
        uint256 expectedPriorTokenAmount = _schedulePriorTokenAmount.add(_scheduleTokenAmount);
        uint256 currentTokenAmount = balanceOf(_scheduleTokenAddress).sub(payableReserveAdjustment());
        require(currentTokenAmount == expectedPriorTokenAmount, "Invoker: incorrect liquidity amount sourced");
        require(transfer(_scheduleTokenAddress, _scheduleInvokeTo, _scheduleTokenAmount), "Invoker: transfer failed");

        IInvokable(_scheduleInvokeTo).execute{ value: _scheduleInvokeValue }(_scheduleInvokeData);
        emit Invocation(_scheduleInvokeTo, _scheduleInvokeValue, keccak256(_scheduleInvokeData), _scheduleTokenAmount);

        uint256 expectedResultingTokenAmount = _schedulePriorTokenAmount.add(_scheduleRepayAmount);
        require(balanceOf(_scheduleTokenAddress) == expectedResultingTokenAmount, "Invoker: incorrect repayment amount");

        for (uint256 i = 0; i < _scheduleRepayAmounts.length; i++) {
            address repaymentAddress = ILiquidityProxy(liquidityProxy(i)).getRepaymentAddress(_scheduleTokenAddress);
            require(
                transfer(_scheduleTokenAddress, repaymentAddress, _scheduleRepayAmounts[i]),
                "Invoker: pool repayment transfer failed"
            );
        }
    }

    function disburseReward() internal {
        uint256 modifiedPoolReward = _poolRewardAddresses[_scheduleTokenAddress] == address(0) ? 0 : _schedulePoolReward;
        if (modifiedPoolReward > 0) {
            require(
                transfer(_scheduleTokenAddress, _poolRewardAddresses[_scheduleTokenAddress], modifiedPoolReward),
                "Invoker: pool reward transfer failed"
            );
        }
        if (_schedulePlatformReward > 0) {
            require(
                transfer(_scheduleTokenAddress, _platformVaultAddress, _schedulePlatformReward),
                "Invoker: platform reward transfer failed"
            );
        }
        emit Reward(modifiedPoolReward, _schedulePlatformReward, _scheduleTokenAddress);
    }

    /*
     * EXECUTION SCHEDULING
     */

    function scheduleExecution(
        address invokeSender,
        address invokeTo,
        uint256 invokeValue,
        bytes memory invokeData,
        address tokenAddress,
        uint256 tokenAmount
    ) internal {
        _scheduleInvokeSender = invokeSender;
        _scheduleInvokeTo = invokeTo;
        _scheduleInvokeValue = invokeValue;
        _scheduleInvokeData = invokeData;
        _scheduleTokenAddress = tokenAddress;
        _scheduleTokenAmount = tokenAmount;
        _schedulePriorTokenAmount = balanceOf(tokenAddress).sub(payableReserveAdjustment());

        uint256 tokenAmountLeft = tokenAmount;
        for (uint256 i = 0; i < liquidityProxiesForToken(); i++) {
            ILiquidityProxy proxy = ILiquidityProxy(liquidityProxy(i));
            uint256 totalReserve = proxy.getTotalReserve(tokenAddress);
            if (totalReserve == 0) {
                continue;
            }
            if (tokenAmountLeft <= totalReserve) {
                uint256 proxyRepayAmount = proxy.getRepaymentAmount(tokenAddress, tokenAmountLeft);
                _scheduleTokenAmounts.push(tokenAmountLeft);
                _scheduleRepayAmounts.push(proxyRepayAmount);
                _scheduleRepayAmount = _scheduleRepayAmount.add(proxyRepayAmount);
                tokenAmountLeft = 0;
                break;
            } else {
                uint256 proxyRepayAmount = proxy.getRepaymentAmount(tokenAddress, totalReserve);
                _scheduleTokenAmounts.push(totalReserve);
                _scheduleRepayAmounts.push(proxyRepayAmount);
                _scheduleRepayAmount = _scheduleRepayAmount.add(proxyRepayAmount);
                tokenAmountLeft = tokenAmountLeft.sub(totalReserve);
            }
        }
        require(tokenAmountLeft == 0, "Invoker: not enough liquidity");

        _schedulePoolReward = calculatePoolReward(_scheduleTokenAmount);
        _schedulePlatformReward = calculatePlatformReward(_scheduleTokenAmount);
        _scheduleRepayAmount = _scheduleRepayAmount.add(_schedulePoolReward).add(_schedulePlatformReward);

        _scheduled = true;
    }

    function cleanSchedule() internal {
        _scheduled = false;
        _schedulePriorTokenAmount = 0;
        _scheduleInvokeSender = address(0);
        _scheduleInvokeTo = address(0);
        _scheduleInvokeValue = 0;
        delete _scheduleInvokeData;
        _scheduleIndex = 0;
        _scheduleTokenAddress = address(0);
        _scheduleTokenAmount = 0;
        delete _scheduleTokenAmounts;
        _scheduleRepayAmount = 0;
        delete _scheduleRepayAmounts;
        _schedulePoolReward = 0;
        _schedulePlatformReward = 0;
    }

    /*
     * INVOKABLE HELPERS
     */

    function currentSender() external view override returns (address) {
        return _scheduleInvokeSender;
    }

    function currentTokenAddress() external view override returns (address) {
        return _scheduleTokenAddress;
    }

    function currentTokenAmount() external view override returns (uint256) {
        return _scheduleTokenAmount;
    }

    function currentRepaymentAmount() external view override returns (uint256) {
        return _scheduleRepayAmount;
    }

    function estimateRepaymentAmount(address tokenAddress, uint256 tokenAmount) external view returns (uint256) {
        require(isTokenAddressRegistered(tokenAddress), "Invoker: no liquidity for token");

        uint256 repaymentAmount = 0;
        uint256 tokenAmountLeft = tokenAmount;

        for (uint256 i = 0; i < _liquidityProxies[tokenAddress].length; i++) {
            ILiquidityProxy proxy = ILiquidityProxy(_liquidityProxies[tokenAddress][i]);
            uint256 totalReserve = proxy.getTotalReserve(tokenAddress);
            if (tokenAmountLeft <= totalReserve) {
                uint256 proxyRepayAmount = proxy.getRepaymentAmount(tokenAddress, tokenAmountLeft);
                repaymentAmount = repaymentAmount.add(proxyRepayAmount);
                tokenAmountLeft = 0;
                break;
            } else {
                uint256 proxyRepayAmount = proxy.getRepaymentAmount(tokenAddress, totalReserve);
                repaymentAmount = repaymentAmount.add(proxyRepayAmount);
                tokenAmountLeft = tokenAmountLeft.sub(totalReserve);
            }
        }
        require(tokenAmountLeft == 0, "Invoker: not enough liquidity");

        return repaymentAmount.add(calculatePoolReward(tokenAmount)).add(calculatePlatformReward(tokenAmount));
    }

    /*
     * REWARDS
     */

    function calculatePoolReward(uint256 tokenAmount) internal view returns (uint256) {
        return tokenAmount.mul(_poolRewardBips).div(10000);
    }

    function calculatePlatformReward(uint256 tokenAmount) internal view returns (uint256) {
        return tokenAmount.mul(_platformRewardBips).div(10000);
    }

    function poolReward() external view override returns (uint256) {
        return _poolRewardBips;
    }

    function poolRewardAddress(address tokenAddress) external view override returns (address) {
        return _poolRewardAddresses[tokenAddress];
    }

    function platformReward() external view override returns (uint256) {
        return _platformRewardBips;
    }

    function platformVaultAddress() external view override returns (address) {
        return _platformVaultAddress;
    }

    function setPoolReward(uint256 poolRewardBips) external onlyFresh onlyOwner {
        _poolRewardBips = poolRewardBips;
    }

    function setPoolRewardAddress(address tokenAddress, address rewardAddress) external onlyFresh onlyOwner {
        _poolRewardAddresses[tokenAddress] = rewardAddress;
    }

    function setPlatformReward(uint256 platformRewardBips) external onlyFresh onlyOwner {
        _platformRewardBips = platformRewardBips;
    }

    function setPlatformVaultAddress(address vaultAddress) external onlyFresh onlyOwner {
        _platformVaultAddress = vaultAddress;
    }

    /*
     * ASSET HELPERS
     */

    function payableReserveAdjustment() internal view returns (uint256) {
        return _scheduleTokenAddress == address(1) ? _scheduleInvokeValue : 0;
    }

    /*
     * LIQUIDITY PROXIES
     */

    function setLiquidityProxies(address tokenAddress, address[] calldata liquidityProxies) external onlyFresh onlyOwner {
        _liquidityProxies[tokenAddress] = liquidityProxies;
    }

    function liquidityProxies(address tokenAddress) external view returns (address[] memory) {
        return _liquidityProxies[tokenAddress];
    }

    function isTokenAddressRegistered(address tokenAddress) public view override returns (bool) {
        return _liquidityProxies[tokenAddress].length > 0;
    }

    function liquidityProxy(uint256 index) internal view returns (address) {
        return _liquidityProxies[_scheduleTokenAddress][index];
    }

    function liquidityProxiesForToken() internal view returns (uint256) {
        return _liquidityProxies[_scheduleTokenAddress].length;
    }

    function totalLiquidity(address tokenAddress) external view override returns (uint256) {
        if (isTokenAddressRegistered(tokenAddress)) {
            uint256 total = 0;
            for (uint256 i = 0; i < _liquidityProxies[tokenAddress].length; i++) {
                ILiquidityProxy proxy = ILiquidityProxy(_liquidityProxies[tokenAddress][i]);
                total = total.add(proxy.getTotalReserve(tokenAddress));
            }
            return total;
        }
        return 0;
    }

    /* This contract should never have a token balance at rest. If so it is in error, then transfer the tokens to vault */
    function removeStuckTokens(address tokenAddress, uint256 amount) external onlyFresh onlyOwner returns (bool) {
        return transfer(tokenAddress, _platformVaultAddress, amount);
    }

    /*
     * MODIFIERS
     */

    modifier onlyFresh() {
        require(!_scheduled, "Invoker: not fresh environment");
        _;
    }

    modifier onlyScheduled() {
        require(_scheduled, "Invoker: not scheduled");
        _;
    }

    fallback() external payable {}
}
