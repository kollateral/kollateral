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

                   {}
   ,   A           {}
  / \, | ,        .--.
 |    =|= >      /.--.\
  \ /` | `       |====|
   `   |         |`::`|
       |     .-;`\..../`;_.-^-._
      /\\/  /  |...::..|`   :   `|
      |:'\ |   /'''::''|   .:.   |
       \ /\;-,/\   ::  |...:::...|
       |\ <` >  >._::_.| ':::::' |
       | `""`  /   ^^  |   ':'   |
       |       |       \    :    /
       |       |        \   :   /
       |       |___/\___|`-.:.-`
       |        \_ || _/    `
       |        <_ >< _>
       |        |  ||  |
       |        |  ||  |
       |       _\.:||:./_
       |      /____/\____\

*/
// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.2;

import "hardhat/console.sol";

import "@openzeppelin/contracts/access/AccessControl.sol";

import "../interfaces/governance/IVotingPower.sol";
import "../interfaces/governance/ITokenRegistry.sol";
import "../interfaces/governance/IVotingPowerFormula.sol";

/**
 * @title Lord (prev. LockManager)
 * @dev Manages voting power for stakes that are locked within the Kingmaker protocol contracts, but not into the Crown.
 */
contract Lord is AccessControl {
	/// @notice Admin role to create voting power from locked stakes
	bytes32 public constant LOCKER_ROLE = keccak256("LOCKER_ROLE");

	/// @notice The amount of a given locked token that has been staked, and the resulting voting power
	struct LockedStake {
		uint256 amount;
		uint256 votingPower;
	}

	// Official record of staked balances for each account > token > locked stake
	mapping(address => mapping(address => LockedStake)) lockedStakes;

	/// @notice Voting power contract
	IVotingPower public crown;

	/// @notice modifier to restrict functions to only contracts that have been added as lockers
	modifier onlyLords() {
		require(hasRole(LOCKER_ROLE, msg.sender), "Lord::onlyLords: Caller must have LOCKER_ROLE role");
		_;
	}

	/// @notice An event that's emitted when a user's staked balance increases
	event StakeLocked(address indexed user, address indexed token, uint256 indexed amount, uint256 votingPower);

	/// @notice An event that's emitted when a user's staked balance decreases
	event StakeUnlocked(address indexed user, address indexed token, uint256 indexed amount, uint256 votingPower);

	/**
	 * @notice Create new LockManager contract
	 * @param _votingPower VotingPower prism contract
	 * @param _roleManager address that is in charge of assigning roles
	 */
	constructor(address _votingPower, address _roleManager) {
		crown = IVotingPower(_votingPower);
		_setupRole(DEFAULT_ADMIN_ROLE, _roleManager);
	}

	/**
	 * @notice Get total amount of tokens staked in contract by `staker`
	 * @param staker The user with staked tokens
	 * @param stakedToken The staked token
	 * @return total amount staked
	 */
	function getAmountStaked(address staker, address stakedToken) public view returns (uint256) {
		return getStake(staker, stakedToken).amount;
	}

	/**
	 * @notice Get total staked amount and voting power from `stakedToken` staked in contract by `staker`
	 * @param staker The user with staked tokens
	 * @param stakedToken The staked token
	 * @return total staked
	 */
	function getStake(address staker, address stakedToken) public view returns (LockedStake memory) {
		return lockedStakes[staker][stakedToken];
	}

	/**
	 * @notice Calculate the voting power that will result from locking `amount` of `token`
	 * @param token token that will be locked
	 * @param amount amount of token that will be locked
	 * @return resulting voting power
	 */
	function calculateVotingPower(address token, uint256 amount) public view returns (uint256) {
		address registry = crown.tokenRegistry();
		require(registry != address(0), "Lord::calculateVotingPower: registry not set");

		address tokenFormulaAddress = ITokenRegistry(registry).tokenFormula(token);
		require(tokenFormulaAddress != address(0), "Lord::calculateVotingPower: token not supported");

		IVotingPowerFormula tokenFormula = IVotingPowerFormula(tokenFormulaAddress);
		return tokenFormula.toVotingPower(amount);
	}

	/**
	 * @notice Grant voting power from locked `tokenAmount` of `token`
	 * @param receiver recipient of voting power
	 * @param token token that is locked
	 * @param tokenAmount amount of token that is locked
	 * @return votingPowerGranted amount of voting power granted
	 */
	function grantVotingPower(
		address receiver,
		address token,
		uint256 tokenAmount
	) public onlyLords returns (uint256 votingPowerGranted) {
		votingPowerGranted = calculateVotingPower(token, tokenAmount);
		lockedStakes[receiver][token].amount = lockedStakes[receiver][token].amount + tokenAmount;
		lockedStakes[receiver][token].votingPower = lockedStakes[receiver][token].votingPower + votingPowerGranted;
		crown.addVotingPowerForLockedTokens(receiver, votingPowerGranted);

		emit StakeLocked(receiver, token, tokenAmount, votingPowerGranted);
	}

	/**
	 * @notice Remove voting power by unlocking `tokenAmount` of `token`
	 * @param receiver holder of voting power
	 * @param token token that is being unlocked
	 * @param tokenAmount amount of token that is being unlocked
	 * @return votingPowerRemoved amount of voting power removed
	 */
	function removeVotingPower(
		address receiver,
		address token,
		uint256 tokenAmount
	) public onlyLords returns (uint256 votingPowerRemoved) {
		require(lockedStakes[receiver][token].amount >= tokenAmount, "Lord::removeVotingPower: not enough tokens staked");

		LockedStake memory s = getStake(receiver, token);
		votingPowerRemoved = (tokenAmount * s.votingPower) / s.amount;
		lockedStakes[receiver][token].amount = lockedStakes[receiver][token].amount - tokenAmount;
		lockedStakes[receiver][token].votingPower = lockedStakes[receiver][token].votingPower - votingPowerRemoved;
		crown.removeVotingPowerForUnlockedTokens(receiver, votingPowerRemoved);

		emit StakeUnlocked(receiver, token, tokenAmount, votingPowerRemoved);
	}
}
