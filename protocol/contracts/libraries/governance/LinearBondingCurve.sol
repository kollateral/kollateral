/*

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
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

abstract contract LinearBondingCurve {
	// Set decimals equal to ether and ERC20 standard
	uint256 public constant decimals = 10**18;

	function calculatePurchaseReturn(
		uint256 _totalSupply,
		uint256 _poolBalance,
		uint256 _reserveRatio,
		uint256 _amount
	) internal pure returns (uint256) {
		uint256 newTotal = _totalSupply + _amount;
		return (decimals * newTotal**2) / (2 * decimals * decimals) - _poolBalance; // x^2 / 2 + c
	}

	function calculateSaleReturn(
		uint256 _totalSupply,
		uint256 _poolBalance,
		uint256 _reserveRatio,
		uint256 _amount
	) internal pure returns (uint256) {
		uint256 newTotal = _totalSupply - _amount;
		return _poolBalance - newTotal**2 / (2 * decimals);
	}

	/**
	 * @dev Experimental
	 */
	function estimateTokenAmountForPrice(
		uint256 price,
		uint256 poolBalance,
		uint256 reserveRatio,
		uint256 decimals
	) public view returns (uint256 tokenAmount) {
		tokenAmount = sqrt(((price + poolBalance) * 2) / reserveRatio) * decimals;
	}

	// babylonian method (https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Babylonian_method)
	function sqrt(uint256 y) internal pure returns (uint256 z) {
		if (y > 3) {
			z = y;
			uint256 x = y / 2 + 1;
			while (x < z) {
				z = x;
				x = (y / x + x) / 2;
			}
		} else if (y != 0) {
			z = 1;
		}
	}
}
