/*

	Copyright (c) [2020] [Archer DAO]
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

import "../../interfaces/governance/IVotingPowerFormula.sol";

/**
 * @title SushiLPFormula
 * @dev Convert Sushi LP tokens to voting power
 */
contract SushiLPFormula is IVotingPowerFormula {
	/// @notice Current owner of this contract
	address public owner;

	/// @notice Conversion rate of token to voting power (measured in bips: 10,000 bips = 1%)
	uint32 public conversionRate;

	/// @notice Event emitted when the owner of the contract is updated
	event ChangedOwner(address indexed oldOwner, address indexed newOwner);

	/// @notice Event emitted when the conversion rate of the contract is changed
	event ConversionRateChanged(uint32 oldRate, uint32 newRate);

	/// @notice only owner can call function
	modifier onlyOwner {
		require(msg.sender == owner, "not owner");
		_;
	}

	/**
	 * @notice Construct a new voting power formula contract
	 * @param _owner contract owner
	 * @param _cvrRate the conversion rate in bips
	 */
	constructor(address _owner, uint32 _cvrRate) {
		owner = _owner;
		emit ChangedOwner(address(0), owner);

		conversionRate = _cvrRate;
		emit ConversionRateChanged(uint32(0), conversionRate);
	}

	/**
	 * @notice Set conversion rate of contract
	 * @param newConversionRate New conversion rate
	 */
	function setConversionRate(uint32 newConversionRate) external onlyOwner {
		emit ConversionRateChanged(conversionRate, newConversionRate);
		conversionRate = newConversionRate;
	}

	/**
	 * @notice Change owner of contract
	 * @param newOwner New owner address
	 */
	function changeOwner(address newOwner) external onlyOwner {
		emit ChangedOwner(owner, newOwner);
		owner = newOwner;
	}

	/**
	 * @notice Convert token amount to voting power
	 * @param amount token amount
	 * @return voting power amount
	 */
	function toVotingPower(uint256 amount) external view override returns (uint256) {
		return (amount * conversionRate) / 1000000;
	}
}
