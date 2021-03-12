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

import "./ICrownGovernanceToken.sol";
import "./IVotingPower.sol";

interface IVesting {
	struct Grant {
		uint256 startTime;
		uint256 amount;
		uint16 vestingDuration;
		uint16 vestingCliff;
		uint256 totalClaimed;
	}

	event GrantAdded(
		address indexed recipient,
		uint256 indexed amount,
		uint256 startTime,
		uint16 vestingDurationInDays,
		uint16 vestingCliffInDays
	);
	event GrantTokensClaimed(address indexed recipient, uint256 indexed amountClaimed);
	event ChangedOwner(address indexed oldOwner, address indexed newOwner);
	event ChangedVotingPower(address indexed oldContract, address indexed newContract);

	function owner() external view returns (address);

	function token() external view returns (ICrownGovernanceToken);

	function votingPower() external view returns (IVotingPower);

	function addTokenGrant(
		address recipient,
		uint256 startTime,
		uint256 amount,
		uint16 vestingDurationInDays,
		uint16 vestingCliffInDays
	) external;

	function getTokenGrant(address recipient) external view returns (Grant memory);

	function calculateGrantClaim(address recipient) external view returns (uint256);

	function vestedBalance(address account) external view returns (uint256);

	function claimedBalance(address recipient) external view returns (uint256);

	function claimVestedTokens(address recipient) external;

	function tokensVestedPerDay(address recipient) external view returns (uint256);

	function setVotingPowerContract(address newContract) external;

	function changeOwner(address newOwner) external;
}
