/*

    Copyright 2020-2021 ARM Finance LLC

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by crownlicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/
// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/utils/math/Math.sol";

contract RoyalMath {
	using Math for uint256;

	/// @dev Returns 1 in the fixed point representation, with `decimals` decimals.
	function unit(uint8 decimals) internal pure returns (uint256) {
		require(decimals <= 77, "Too many decimals");
		return 10**uint256(decimals);
	}

	/**
	 * @notice Returns ceil(x / y)
	 * @dev panics if y == 0
	 * @param x The dividend
	 * @param y The divisor
	 * @return z The quotient, ceil(x / y)
	 */
	function divRoundingUp(uint256 x, uint256 y) internal pure returns (uint256 z) {
		// addition is safe because (type(uint256).max / 1) + (type(uint256).max % 1 > 0 ? 1 : 0) == type(uint256).max
		z = (x / y) + (x % y > 0 ? 1 : 0);
	}

	/**
	 * @dev divides two float values, required since Solidity does not handle floating point values
	 * @return the float division result
	 */
	function floatDiv(uint256 a, uint256 b) internal pure returns (uint256) {
		return (a * 1000000000000000000 + b / 2) / b;
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
