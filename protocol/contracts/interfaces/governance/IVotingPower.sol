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

import "../../libraries/governance/PrismProxy.sol";

interface IVotingPower {
	struct Stake {
		uint256 amount;
		uint256 votingPower;
	}

	event NewPendingImplementation(address indexed oldPendingImplementation, address indexed newPendingImplementation);
	event NewImplementation(address indexed oldImplementation, address indexed newImplementation);
	event NewPendingAdmin(address indexed oldPendingAdmin, address indexed newPendingAdmin);
	event NewAdmin(address indexed oldAdmin, address indexed newAdmin);
	// TODO: should be able to trim around here, if used as Facet in a Diamond
	event Staked(address indexed user, address indexed token, uint256 indexed amount, uint256 votingPower);
	event Withdrawn(address indexed user, address indexed token, uint256 indexed amount, uint256 votingPower);
	event VotingPowerChanged(address indexed voter, uint256 indexed previousBalance, uint256 indexed newBalance);

	function setPendingProxyImplementation(address newPendingImplementation) external returns (bool);

	function acceptProxyImplementation() external returns (bool);

	function setPendingProxyAdmin(address newPendingAdmin) external returns (bool);

	function acceptProxyAdmin() external returns (bool);

	function proxyAdmin() external view returns (address);

	function pendingProxyAdmin() external view returns (address);

	function proxyImplementation() external view returns (address);

	function pendingProxyImplementation() external view returns (address);

	function proxyImplementationVersion() external view returns (uint8);

	function become(PrismProxy prism) external;

	// TODO: should be able to trim around here, if used as Facet in a Diamond
	function initialize(address _govToken, address _vestingContract) external;

	function owner() external view returns (address);

	function govToken() external view returns (address);

	function vestingContract() external view returns (address);

	function tokenRegistry() external view returns (address);

	function lockManager() external view returns (address);

	function changeOwner(address newOwner) external;

	function setTokenRegistry(address registry) external;

	function setLockManager(address newLockManager) external;

	function stake(uint256 amount) external;

	function stakeWithPermit(
		uint256 amount,
		uint256 deadline,
		uint8 v,
		bytes32 r,
		bytes32 s
	) external;

	function withdraw(uint256 amount) external;

	function addVotingPowerForVestingTokens(address account, uint256 amount) external;

	function removeVotingPowerForClaimedTokens(address account, uint256 amount) external;

	function addVotingPowerForLockedTokens(address account, uint256 amount) external;

	function removeVotingPowerForUnlockedTokens(address account, uint256 amount) external;

	function getCrownTokenAmountStaked(address staker) external view returns (uint256);

	function getAmountStaked(address staker, address stakedToken) external view returns (uint256);

	function getCrownTokenStake(address staker) external view returns (Stake memory);

	function getStake(address staker, address stakedToken) external view returns (Stake memory);

	function balanceOf(address account) external view returns (uint256);

	function balanceOfAtBlock(address account, uint256 blockNumber) external view returns (uint256);
}
