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

import "../math/RoyalMath.sol";

abstract contract AlchemicalBondingCurve is RoyalMath {
	// Set decimals equal to ether and ERC20-compliant tokens
	uint256 public constant decimals = 10**18;

	function curvedPayable(
		uint256 _totalSupply,
		uint256 _totalProvided,
		uint256 _amount,
		uint32 _weight
	) internal pure returns (uint256) {
		uint256 newTotal = _totalSupply + _totalProvided + _amount;
		uint256 newPrice = newTotal * (newTotal / decimals) * (newTotal / decimals);
		return sqrt(newPrice / _weight); // -sqrt(x^3/w)
	}

	function flatPayable(
		uint256 _totalSupply,
		uint256 _amount,
		uint32 _weight
	) internal pure returns (uint256) {
		return ((_totalSupply * _amount) / decimals) / _weight;
	}
}
