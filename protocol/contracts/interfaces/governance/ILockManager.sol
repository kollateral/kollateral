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
pragma solidity ^0.8.1;

interface ILockManager {
	struct LockedStake {
		uint256 amount;
		uint256 votingPower;
	}

	function getAmountStaked(address staker, address stakedToken) external view returns (uint256);

	function getStake(address staker, address stakedToken) external view returns (LockedStake memory);

	function calculateVotingPower(address token, uint256 amount) external view returns (uint256);

	function grantVotingPower(
		address receiver,
		address token,
		uint256 tokenAmount
	) external returns (uint256 votingPowerGranted);

	function removeVotingPower(
		address receiver,
		address token,
		uint256 tokenAmount
	) external returns (uint256 votingPowerRemoved);
}
