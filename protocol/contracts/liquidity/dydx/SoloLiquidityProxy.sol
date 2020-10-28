/*

    Copyright 2020 Kollateral LLC
    Copyright 2020 ARM Finance LLC

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
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "./ICallee.sol";
import "./ISoloMargin.sol";
import "./Types.sol";
import "../ILiquidityProxy.sol";
import "../../common/invoke/IInvoker.sol";
import "../../common/utils/BalanceCarrier.sol";
import "../../common/utils/WETHHandler.sol";

contract SoloLiquidityProxy is BalanceCarrier, ICallee, ILiquidityProxy, Ownable, WETHHandler {
    using SafeMath for uint256;

    uint256 internal NULL_ACCOUNT_ID = 0;
    uint256 internal NULL_MARKET_ID = 0;
    Types.AssetAmount internal NULL_AMOUNT = Types.AssetAmount({
        sign: false,
        denomination: Types.AssetDenomination.Wei,
        ref: Types.AssetReference.Delta,
        value: 0
    });
    bytes internal NULL_DATA = "";

    address internal _soloMarginAddress;
    mapping(address => uint256) internal _tokenAddressToMarketId;
    mapping(uint256 => address) internal _marketIdToTokenAddress;
    mapping(address => bool) internal _tokenAddressRegistered;

    address payable internal _scheduleInvokerAddress;
    address internal _scheduleTokenAddress;
    uint256 internal _scheduleTokenAmount;


    constructor (address soloMarginAddress, address payable wethAddress) BalanceCarrier(address(1)) WETHHandler(wethAddress) public {
        _soloMarginAddress = soloMarginAddress;
    }

    function registerPool(uint256 marketId) external onlyOwner {
        address tokenAddress = unmapTokenAddress(ISoloMargin(_soloMarginAddress).getMarketTokenAddress(marketId));
        require(tokenAddress != address(0), "SoloLiquidityProxy: cannot register empty market");

        _tokenAddressToMarketId[tokenAddress] = marketId;
        _marketIdToTokenAddress[marketId] = tokenAddress;
        _tokenAddressRegistered[tokenAddress] = true;
        IERC20(remapTokenAddress(tokenAddress)).approve(_soloMarginAddress, uint256(-1));
    }

    function deregisterPool(uint256 marketId) external onlyOwner {
        address tokenAddress = _marketIdToTokenAddress[marketId];

        _tokenAddressToMarketId[tokenAddress] = 0;
        _marketIdToTokenAddress[marketId] = address(0);
        _tokenAddressRegistered[tokenAddress] = false;
        IERC20(remapTokenAddress(tokenAddress)).approve(_soloMarginAddress, 0);
    }

    function getRepaymentAddress(address tokenAddress) external override view returns (address) {
        return address(this);
    }

    function getTotalReserve(address tokenAddress) external override view returns (uint256) {
        if (isRegistered(tokenAddress) && !isClosing(tokenAddress)) {
            return IERC20(remapTokenAddress(tokenAddress)).balanceOf(_soloMarginAddress);
        }

        return 0;
    }

    function getRepaymentAmount(address tokenAddress, uint256 tokenAmount) external override view returns (uint256) {
        return getRepaymentAmountInternal(tokenAddress, tokenAmount);
    }

    function getRepaymentAmountInternal(address tokenAddress, uint256 tokenAmount) internal view returns (uint256) {
        // Add 1 wei for markets 0-1 and 2 wei for markets 2-3
        return tokenAmount.add(marketIdFromTokenAddress(tokenAddress) < 2 ? 1 : 2);
    }

    function borrow(address tokenAddress, uint256 tokenAmount) external override {
        _scheduleInvokerAddress = msg.sender;
        _scheduleTokenAddress = tokenAddress;
        _scheduleTokenAmount = tokenAmount;

        ISoloMargin solo = ISoloMargin(_soloMarginAddress);
        Types.ActionArgs[] memory operations = new Types.ActionArgs[](3);
        operations[0] = getWithdrawAction(tokenAddress, tokenAmount);
        operations[1] = getCallAction();
        operations[2] = getDepositAction(tokenAddress, getRepaymentAmountInternal(tokenAddress, tokenAmount));
        Types.AccountInfo[] memory accountInfos = new Types.AccountInfo[](1);
        accountInfos[0] = getAccountInfo();

        solo.operate(accountInfos, operations);

        _scheduleInvokerAddress = address(0);
        _scheduleTokenAddress = address(0);
        _scheduleTokenAmount = 0;
    }

    function callFunction(address sender, Types.AccountInfo memory accountInfo, bytes memory data) public override {
        require(_scheduleInvokerAddress != address(0), "SoloLiquidityProxy: not scheduled");

        if (_scheduleTokenAddress == address(1)) {
            unwrap(_scheduleTokenAmount);
        }

        require(
            transfer(_scheduleTokenAddress, _scheduleInvokerAddress, _scheduleTokenAmount),
            "SoloLiquidityProxy: transfer to invoker failed");

        IInvoker invoker = IInvoker(_scheduleInvokerAddress);
        invoker.invokeCallback();

        if (_scheduleTokenAddress == address(1)) {
            wrap(getRepaymentAmountInternal(_scheduleTokenAddress, _scheduleTokenAmount));
        }
    }

    function getAccountInfo() internal view returns (Types.AccountInfo memory) {
        return Types.AccountInfo({
            owner: address(this),
            number: 1
        });
    }

    function getWithdrawAction(address tokenAddress, uint256 tokenAmount)
    internal
    view
    returns (Types.ActionArgs memory)
    {
        return Types.ActionArgs({
            actionType: Types.ActionType.Withdraw,
            accountId: 0,
            amount: Types.AssetAmount({
                sign: false,
                denomination: Types.AssetDenomination.Wei,
                ref: Types.AssetReference.Delta,
                value: tokenAmount
            }),
            primaryMarketId: marketIdFromTokenAddress(tokenAddress),
            secondaryMarketId: NULL_MARKET_ID,
            otherAddress: address(this),
            otherAccountId: NULL_ACCOUNT_ID,
            data: NULL_DATA
        });
    }

    function getDepositAction(address tokenAddress, uint256 repaymentAmount)
    internal
    view
    returns (Types.ActionArgs memory)
    {
        return Types.ActionArgs({
            actionType: Types.ActionType.Deposit,
            accountId: 0,
            amount: Types.AssetAmount({
                sign: true,
                denomination: Types.AssetDenomination.Wei,
                ref: Types.AssetReference.Delta,
                value: repaymentAmount
            }),
            primaryMarketId: marketIdFromTokenAddress(tokenAddress),
            secondaryMarketId: NULL_MARKET_ID,
            otherAddress: address(this),
            otherAccountId: NULL_ACCOUNT_ID,
            data: NULL_DATA
        });
    }

    function getCallAction()
    internal
    view
    returns (Types.ActionArgs memory)
    {
        return Types.ActionArgs({
            actionType: Types.ActionType.Call,
            accountId: 0,
            amount: NULL_AMOUNT,
            primaryMarketId: NULL_MARKET_ID,
            secondaryMarketId: NULL_MARKET_ID,
            otherAddress: address(this),
            otherAccountId: NULL_ACCOUNT_ID,
            data: NULL_DATA
        });
    }

    function isRegistered(address tokenAddress) internal view returns (bool) {
        return _tokenAddressRegistered[tokenAddress];
    }

    function marketIdFromTokenAddress(address tokenAddress) internal view returns (uint256) {
        return _tokenAddressToMarketId[tokenAddress];
    }

    function remapTokenAddress(address tokenAddress) internal view returns (address) {
        return tokenAddress == address(1) ? _wethAddress : tokenAddress;
    }

    function unmapTokenAddress(address tokenAddress) internal view returns (address) {
        return tokenAddress == _wethAddress ? address(1) : tokenAddress;
    }

    function isClosing(address tokenAddress) internal view returns (bool) {
        uint256 marketId = _tokenAddressToMarketId[tokenAddress];
        return ISoloMargin(_soloMarginAddress).getMarketIsClosing(marketId);
    }

    fallback() external { }
}