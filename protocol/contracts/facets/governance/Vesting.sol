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

import "hardhat/console.sol";

import "../../interfaces/governance/IVotingPower.sol";
import "../../interfaces/governance/ICrownGovernanceToken.sol";

import "../../libraries/math/SafeMath.sol";

/**
 * @title Vesting
 * @dev The vesting vault contract for the initial token sale
 */
contract Vesting {
	using SafeMath for uint256;

	/// @notice Grant definition
	struct Grant {
		uint256 startTime;
		uint256 amount;
		uint16 vestingDuration;
		uint16 vestingCliff;
		uint256 totalClaimed;
	}

	/// @dev Used to translate vesting periods specified in days to seconds
	uint256 internal constant SECONDS_PER_DAY = 86400;

	/// @dev Used to limit vesting periods specified in days
	uint16 internal constant MAX_GRANT_VESTING_DAYS = 9 * 365;

	/// @dev Used to limit cliff periods specified in days
	uint16 internal constant MAX_GRANT_CLIFF_DAYS = 1 * 365;

	/// @notice Crown Governance token
	ICrownGovernanceToken public token;

	/// @notice Voting power contract
	IVotingPower public votingPower;

	/// @notice Mapping of recipient address > token grant
	mapping(address => Grant) public tokenGrants;

	/// @notice Current owner of this contract
	address public owner;

	/// @notice Event emitted when a new grant is created
	event GrantAdded(
		address indexed recipient,
		uint256 indexed amount,
		uint256 startTime,
		uint16 vestingDurationInDays,
		uint16 vestingCliffInDays
	);

	/// @notice Event emitted when tokens are claimed by a recipient from a grant
	event GrantTokensClaimed(address indexed recipient, uint256 indexed amountClaimed);

	/// @notice Event emitted when the owner of the vesting contract is updated
	event ChangedOwner(address indexed oldOwner, address indexed newOwner);

	/// @notice Event emitted when the voting power contract referenced by the vesting contract is updated
	event ChangedVotingPower(address indexed oldContract, address indexed newContract);

	/**
	 * @notice Construct a new Vesting contract
	 * @param _token Address of ARCH token
	 */
	constructor(address _token) {
		require(_token != address(0), "Vest::constructor: must be valid token address");
		token = ICrownGovernanceToken(_token);
		owner = msg.sender;
	}

	/**
	 * @notice Add a new token grant
	 * @param recipient The address that is receiving the grant
	 * @param startTime The unix timestamp when the grant will start
	 * @param amount The amount of tokens being granted
	 * @param vestingDurationInDays The vesting period in days
	 * @param vestingCliffInDays The vesting cliff duration in days
	 */
	function addTokenGrant(
		address recipient,
		uint256 startTime,
		uint256 amount,
		uint16 vestingDurationInDays,
		uint16 vestingCliffInDays
	) external {
		require(msg.sender == owner, "Vest::addTokenGrant: not owner");
		require(address(votingPower) != address(0), "Vest::addTokenGrant: Set Voting Power contract first");
		require(vestingCliffInDays <= MAX_GRANT_CLIFF_DAYS, "Vest::addTokenGrant: cliff more than 1 year");
		require(vestingDurationInDays > 0, "Vest::addTokenGrant: duration must be > 0");
		require(vestingDurationInDays <= MAX_GRANT_VESTING_DAYS, "Vest::addTokenGrant: duration more than 9 years");
		require(vestingDurationInDays >= vestingCliffInDays, "Vest::addTokenGrant: duration < cliff");
		require(tokenGrants[recipient].amount == 0, "Vest::addTokenGrant: grant already exists for account");

		uint256 amountVestedPerDay = amount.div(vestingDurationInDays);
		require(amountVestedPerDay > 0, "Vest::addTokenGrant: amountVestedPerDay > 0");

		// Transfer the grant tokens under the control of the vesting contract
		require(token.transferFrom(owner, address(this), amount), "Vest::addTokenGrant: transfer failed");

		uint256 grantStartTime = startTime == 0 ? block.timestamp : startTime;

		Grant memory grant =
			Grant({
				startTime: grantStartTime,
				amount: amount,
				vestingDuration: vestingDurationInDays,
				vestingCliff: vestingCliffInDays,
				totalClaimed: 0
			});
		tokenGrants[recipient] = grant;
		emit GrantAdded(recipient, amount, grantStartTime, vestingDurationInDays, vestingCliffInDays);
		votingPower.addVotingPowerForVestingTokens(recipient, amount);
	}

	/**
	 * @notice Get token grant for recipient
	 * @param recipient The address that has a grant
	 * @return the grant
	 */
	function getTokenGrant(address recipient) public view returns (Grant memory) {
		return tokenGrants[recipient];
	}

	/**
	 * @notice Calculate the vested and unclaimed tokens available for `recipient` to claim
	 * @dev Due to rounding errors once grant duration is reached, returns the entire left grant amount
	 * @dev Returns 0 if cliff has not been reached
	 * @param recipient The address that has a grant
	 * @return The amount recipient can claim
	 */
	function calculateGrantClaim(address recipient) public view returns (uint256) {
		Grant storage tokenGrant = tokenGrants[recipient];

		// For grants created with a future start date, that hasn't been reached, return 0, 0
		if (block.timestamp < tokenGrant.startTime) {
			return 0;
		}

		// Check cliff was reached
		uint256 elapsedTime = block.timestamp.sub(tokenGrant.startTime);
		uint256 elapsedDays = elapsedTime.div(SECONDS_PER_DAY);

		if (elapsedDays < tokenGrant.vestingCliff) {
			return 0;
		}

		// If over vesting duration, all tokens vested
		if (elapsedDays >= tokenGrant.vestingDuration) {
			uint256 remainingGrant = tokenGrant.amount.sub(tokenGrant.totalClaimed);
			return remainingGrant;
		} else {
			uint256 vestingDurationInSecs = uint256(tokenGrant.vestingDuration).mul(SECONDS_PER_DAY);
			uint256 vestingAmountPerSec = tokenGrant.amount.div(vestingDurationInSecs);
			uint256 amountVested = vestingAmountPerSec.mul(elapsedTime);
			uint256 claimableAmount = amountVested.sub(tokenGrant.totalClaimed);
			return claimableAmount;
		}
	}

	/**
	 * @notice Calculate the vested (claimed + unclaimed) tokens for `recipient`
	 * @dev Returns 0 if cliff has not been reached
	 * @param recipient The address that has a grant
	 * @return Total vested balance (claimed + unclaimed)
	 */
	function vestedBalance(address recipient) external view returns (uint256) {
		Grant storage tokenGrant = tokenGrants[recipient];

		// For grants created with a future start date, that hasn't been reached, return 0, 0
		if (block.timestamp < tokenGrant.startTime) {
			return 0;
		}

		// Check cliff was reached
		uint256 elapsedTime = block.timestamp.sub(tokenGrant.startTime);
		uint256 elapsedDays = elapsedTime.div(SECONDS_PER_DAY);

		if (elapsedDays < tokenGrant.vestingCliff) {
			return 0;
		}

		// If over vesting duration, all tokens vested
		if (elapsedDays >= tokenGrant.vestingDuration) {
			return tokenGrant.amount;
		} else {
			uint256 vestingDurationInSecs = uint256(tokenGrant.vestingDuration).mul(SECONDS_PER_DAY);
			uint256 vestingAmountPerSec = tokenGrant.amount.div(vestingDurationInSecs);
			uint256 amountVested = vestingAmountPerSec.mul(elapsedTime);
			return amountVested;
		}
	}

	/**
	 * @notice The balance claimed by `recipient`
	 * @param recipient The address that has a grant
	 * @return the number of claimed tokens by `recipient`
	 */
	function claimedBalance(address recipient) external view returns (uint256) {
		Grant storage tokenGrant = tokenGrants[recipient];
		return tokenGrant.totalClaimed;
	}

	/**
	 * @notice Allows a grant recipient to claim their vested tokens
	 * @dev Errors if no tokens have vested
	 * @dev It is advised recipients check they are entitled to claim via `calculateGrantClaim` before calling this
	 * @param recipient The address that has a grant
	 */
	function claimVestedTokens(address recipient) external {
		uint256 amountVested = calculateGrantClaim(recipient);
		require(amountVested > 0, "Vest::claimVested: amountVested is 0");
		votingPower.removeVotingPowerForClaimedTokens(recipient, amountVested);

		Grant storage tokenGrant = tokenGrants[recipient];
		tokenGrant.totalClaimed = uint256(tokenGrant.totalClaimed.add(amountVested));

		require(token.transfer(recipient, amountVested), "Vest::claimVested: transfer failed");
		emit GrantTokensClaimed(recipient, amountVested);
	}

	/**
	 * @notice Calculate the number of tokens that will vest per day for the given recipient
	 * @param recipient The address that has a grant
	 * @return Number of tokens that will vest per day
	 */
	function tokensVestedPerDay(address recipient) public view returns (uint256) {
		Grant storage tokenGrant = tokenGrants[recipient];
		return tokenGrant.amount.div(uint256(tokenGrant.vestingDuration));
	}

	/**
	 * @notice Set voting power contract address
	 * @param newContract New voting power contract address
	 */
	function setVotingPowerContract(address newContract) external {
		require(msg.sender == owner, "Vest::setVotingPowerContract: not owner");
		require(
			newContract != address(0) && newContract != address(this) && newContract != address(token),
			"Vest::setVotingPowerContract: not valid contract"
		);
		require(
			IVotingPower(newContract).govToken() == address(token),
			"Vest::setVotingPowerContract: voting power not initialized"
		);

		address oldContract = address(votingPower);
		votingPower = IVotingPower(newContract);
		emit ChangedVotingPower(oldContract, newContract);
	}

	/**
	 * @notice Change owner of vesting contract
	 * @param newOwner New owner address
	 */
	function changeOwner(address newOwner) external {
		require(msg.sender == owner, "Vest::changeOwner: not owner");
		require(
			newOwner != address(0) && newOwner != address(this) && newOwner != address(token),
			"Vest::changeOwner: not valid address"
		);

		address oldOwner = owner;
		owner = newOwner;
		emit ChangedOwner(oldOwner, newOwner);
	}
}
