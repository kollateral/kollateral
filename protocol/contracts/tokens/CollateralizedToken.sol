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

import "./UnlimitedApprovalERC20.sol";
import "../__oz__/math/SafeMath.sol";
import "../__oz__/utils/ReentrancyGuard.sol";
import "../common/utils/ExtendedMath.sol";

abstract contract CollateralizedToken is ExtendedMath, ReentrancyGuard, UnlimitedApprovalERC20 {
	using SafeMath for uint256;

	event Mint(address minter, uint256 tokenAmount, uint256 kTokenAmount);
	event Redeem(address redeemer, uint256 tokenAmount, uint256 kTokenAmount);

	address internal _underlying;

	constructor(address underlying) {
		_underlying = underlying;
	}

	/*
	 * BALANCE UPDATE
	 */

	function redeem(uint256 kTokenAmount) external returns (bool) {
		require(totalSupply() > 0, "CollateralizedToken: no supply");
		return redeemInternal(nativeAmountToUnderlyingAmount(kTokenAmount), kTokenAmount);
	}

	function redeemUnderlying(uint256 tokenAmount) external returns (bool) {
		require(totalReserve() > 0, "CollateralizedToken: no reserve");
		return redeemInternal(tokenAmount, underlyingAmountToNativeAmountInternal(tokenAmount, true, false));
	}

	function mintInternal(uint256 amount) internal nonReentrant returns (bool) {
		uint256 kTokenAmount;
		if (totalReserve().sub(amount) > 0) {
			kTokenAmount = underlyingAmountToNativeAmountInternal(amount, false, true);
		} else {
			kTokenAmount = amount;
		}
		_mint(msg.sender, kTokenAmount);
		emit Mint(msg.sender, amount, kTokenAmount);

		return true;
	}

	function redeemInternal(uint256 tokenAmount, uint256 kTokenAmount) internal nonReentrant returns (bool) {
		_burn(msg.sender, kTokenAmount);
		require(transferUnderlying(msg.sender, tokenAmount), "CollateralizedToken: token transfer failed");
		emit Redeem(msg.sender, tokenAmount, kTokenAmount);

		return true;
	}

	function transferUnderlying(address to, uint256 amount) internal virtual returns (bool);

	/*
	 * VIEWS
	 */

	function nativeAmountToUnderlyingAmount(uint256 nativeAmount) public view returns (uint256) {
		if (totalSupply() == 0) {
			return 0;
		}

		return nativeAmount.mul(totalReserve()).div(totalSupply());
	}

	function underlyingAmountToNativeAmount(uint256 underlyingAmount, bool ceil) public view returns (uint256) {
		return underlyingAmountToNativeAmountInternal(underlyingAmount, ceil, false);
	}

	function underlyingAmountToNativeAmountInternal(
		uint256 underlyingAmount,
		bool ceil,
		bool subtractDeposit
	) internal view returns (uint256) {
		if (totalReserve() == 0) {
			return 0;
		}

		/* mint() pulls in funds before calling mintInternal() - normalize for pre-funding amount */
		uint256 adjustedTotalReserve = subtractDeposit ? totalReserve().sub(underlyingAmount) : totalReserve();

		/* round mint() down and redeemUnderlying() up to avoid over-ownership exploits */
		return divAndRound(underlyingAmount.mul(totalSupply()), adjustedTotalReserve, ceil);
	}

	function isUnderlyingEther() public view virtual returns (bool);

	function totalReserve() public view virtual returns (uint256);

	function balanceOfUnderlying(address owner) public view returns (uint256) {
		return nativeAmountToUnderlyingAmount(balanceOf(owner));
	}

	function underlying() public view returns (address) {
		return _underlying;
	}
}
