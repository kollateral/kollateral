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

contract RoyalMath {

	/// @dev Returns 1 in the fixed point representation, with `decimals` decimals.
	function unit(uint8 decimals) internal pure returns (uint256) {
		require(decimals <= 77, "Too many decimals");
		return 10**uint256(decimals);
	}

	/**
 	 * @dev divides two float values, required since Solidity does not handle floating point values
 	 * @return the float division result
 	 */
	function floatDiv(uint256 a, uint256 b) internal pure returns (uint256) {
		return (a * 1000000000000000000 + b / 2) / b;
	}

/**
	function fullMul(uint256 x, uint256 y) public pure returns (uint256 l, uint256 h) {
		uint256 mm = mulmod(x, y, type(uint256).max);
		l = x * y;
		h = mm - l;
		if (mm < l) {
			h -= 1;
		}
	}

	function mulDiv(uint256 x, uint256 y, uint256 z) public pure returns (uint256) {
		(uint256 l, uint256 h) = fullMul(x, y);
		require(h < z);
		uint256 mm = mulmod(x, y, z);
		if (mm > l) {
			h -= 1;
		}
		l -= mm;
		uint256 pow2 = z & -z;
		z /= pow2;
		l /= pow2;
		l += h * ((-pow2) / pow2 + 1);
		uint256 r = 1;
		r *= 2 - z * r;
		r *= 2 - z * r;
		r *= 2 - z * r;
		r *= 2 - z * r;
		r *= 2 - z * r;
		r *= 2 - z * r;
		r *= 2 - z * r;
		r *= 2 - z * r;
		return l * r;
	}
*/
}
