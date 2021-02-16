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

import "./ILendingPool.sol";
import "./ILendingPoolAddressesProvider.sol";
import "./ILendingPoolCore.sol";
import "./ILendingPoolParametersProvider.sol";
import "../ILiquidityProxy.sol";
import "../../libraries/math/SafeMath.sol";
import "../../interfaces/token/ERC20/IERC20.sol";
import "../../common/invoke/IInvoker.sol";
import "../../common/utils/BalanceCarrier.sol";

contract AaveLiquidityProxy is BalanceCarrier, ILiquidityProxy {
	using SafeMath for uint256;

	address internal ETHER_TOKEN_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

	ILendingPoolAddressesProvider internal _lendingPoolAddressProvider;

	address payable internal _scheduleInvokerAddress;

	constructor(ILendingPoolAddressesProvider lendingPoolAddressProvider) BalanceCarrier(ETHER_TOKEN_ADDRESS) {
		_lendingPoolAddressProvider = lendingPoolAddressProvider;
	}

	function getRepaymentAddress(address tokenAddress) external view override returns (address) {
		return _lendingPoolAddressProvider.getLendingPoolCore();
	}

	function getTotalReserve(address tokenAddress) external view override returns (uint256) {
		address core = _lendingPoolAddressProvider.getLendingPoolCore();

		if (isRegistered(tokenAddress)) {
			return tokenAddress == address(1) ? core.balance : IERC20(tokenAddress).balanceOf(core);
		}

		return 0;
	}

	function getRepaymentAmount(address tokenAddress, uint256 tokenAmount) external view override returns (uint256) {
		ILendingPoolParametersProvider params =
			ILendingPoolParametersProvider(_lendingPoolAddressProvider.getLendingPoolParametersProvider());
		(uint256 totalFeeBips, uint256 _void) = params.getFlashLoanFeesInBips();

		uint256 amountFee = tokenAmount.mul(totalFeeBips).div(10000);
		return tokenAmount.add(amountFee);
	}

	function borrow(address tokenAddress, uint256 tokenAmount) external override {
		_scheduleInvokerAddress = payable(msg.sender);

		ILendingPool lendingPool = ILendingPool(_lendingPoolAddressProvider.getLendingPool());
		lendingPool.flashLoan(address(this), remapTokenAddress(tokenAddress), tokenAmount, "");

		_scheduleInvokerAddress = payable(address(0));
	}

	function executeOperation(
		address _reserve,
		uint256 _amount,
		uint256 _fee,
		bytes calldata _params
	) external {
		require(_scheduleInvokerAddress != address(0), "AaveLiquidityProxy: not scheduled");

		require(transfer(_reserve, _scheduleInvokerAddress, _amount), "AaveLiquidityProxy: transfer to invoker failed");

		IInvoker invoker = IInvoker(_scheduleInvokerAddress);
		invoker.invokeCallback();
	}

	function isRegistered(address tokenAddress) internal view returns (bool) {
		ILendingPoolCore core = ILendingPoolCore(_lendingPoolAddressProvider.getLendingPoolCore());
		return core.getReserveIsActive(remapTokenAddress(tokenAddress));
	}

	function remapTokenAddress(address tokenAddress) internal view returns (address) {
		return tokenAddress == address(1) ? ETHER_TOKEN_ADDRESS : tokenAddress;
	}

	fallback() external {}
}
