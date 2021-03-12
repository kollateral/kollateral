/*

	Copyright (c) [2020] [KINGer DAO]
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

        _
       ///-._
      ////////-._
     /////////////-.
    ////////////////`.
   //////////////// .'`.
  //////////////// . '.'`.
 '|`'//////////// . .'.::|`
  :    `'///////   . '.':|
  |  .   . `'//  ' _|- ::|
  |.  .-._  . | .   | .'::
  |   |:|:|   |  ' ' '.::|
  |   |:|:|   :.  . .'.':|
  | . |:|:| . |    .._.:::
  :    `':|   |  ' ////-:|
  |.    .     |  '/////////-._
  |   .     . : .//////////////-._
  :           : ///////////////////-._
  |.          |////////////////////////-._
  |    .  .   :`'//////////////////////////-._
  | .       _.-\\\\``'//////////////////////////-._
  |        /\\\\\\\\..``'//////////////////////////".
  :  .  . /. \\\\\\\\\.  .``'///////////////////// .'`.
  :      /  _ \\\\\\\\\.      ``'//////////////// .  .'`.
  | .   /  (@) \\\\\\\\\.  . .    ``'/////////// .  '.'::|.
 {`)._ '|  _`  .\\\\\\\-`:|#|  .  .   ``'//////   '. .'.:|
  `-{_/`| ||::.  \\'`.:|:.|#| |#|  .      ``'/  ' .##:':::
      `-| |||||  |`.'::|::|#| |#| |#|  .  . '| . .|##|'.:|
        | |||||  : .'::|:.'#| |#| |#| |#|    |    |##|'::|
        | ||||| .| .'.:|::.'' '#| |#| |#| .  :  ' |##|'.:|
       {`\:||||  : .'::|:_.:.  .  '#| |#|    |   .|##|':::
        `-{_/'|_ |_.-'/}_/'-._        '#|    :.   |##:'.:|
           `'{._('}_)-'  `-}_}(-._ .    .    |  ' '` .'::|
                `-'          `-.} /-._    .  :   .'.'_:-'\
                                 `-}_}(-._   | . _.-')_(-'
                                     `-/_)`-.:.-{ \{-'
                                         `-{_'_)-''

*/
// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.1;

import "hardhat/console.sol";

import "../interfaces/governance/IVotingPower.sol";
import "../interfaces/governance/ICrownGovernanceToken.sol";

/**
 * @title Monastery (prev. Vesting)
 * @dev The vesting contract for the initial governance token distribution
 */
contract Monastery {
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

	/// @notice Current clergy of this contract
	address public clergy;

	/// @notice only clergy can call function
	modifier onlyTheChurch {
		require(msg.sender == clergy, "Monastery::onlyTheChurch: not clergy");
		_;
	}

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

	/// @notice Event emitted when the clergy of the vesting contract is updated
	event ApostolicSuccession(address indexed oldOwner, address indexed newOwner);

	/// @notice Event emitted when the voting power contract referenced by the vesting contract is updated
	event ChangedVotingPower(address indexed oldContract, address indexed newContract);

	/**
	 * @notice Construct a new Vesting contract
	 * @param _token Address of KING token
	 */
	constructor(address _token) {
		require(_token != address(0), "Monastery::constructor: must be valid token address");
		token = ICrownGovernanceToken(_token);
		clergy = msg.sender;
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
	) external onlyTheChurch {
		require(address(votingPower) != address(0), "Monastery::addTokenGrant: Set Voting Power contract first");
		require(vestingCliffInDays <= MAX_GRANT_CLIFF_DAYS, "Monastery::addTokenGrant: cliff more than 1 year");
		require(vestingDurationInDays > 0, "Monastery::addTokenGrant: duration must be > 0");
		require(vestingDurationInDays <= MAX_GRANT_VESTING_DAYS, "Monastery::addTokenGrant: duration more than 9 years");
		require(vestingDurationInDays >= vestingCliffInDays, "Monastery::addTokenGrant: duration < cliff");
		require(tokenGrants[recipient].amount == 0, "Monastery::addTokenGrant: grant already exists for account");

		uint256 amountVestedPerDay = amount / vestingDurationInDays;
		require(amountVestedPerDay > 0, "Monastery::addTokenGrant: amountVestedPerDay > 0");

		// Transfer the grant tokens into the vesting contract
		require(token.transferFrom(clergy, address(this), amount), "Monastery::addTokenGrant: transfer failed");

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
		uint256 elapsedTime = block.timestamp - tokenGrant.startTime;
		uint256 elapsedDays = elapsedTime / SECONDS_PER_DAY;

		if (elapsedDays < tokenGrant.vestingCliff) {
			return 0;
		}

		// If over vesting duration, all tokens vested
		if (elapsedDays >= tokenGrant.vestingDuration) {
			uint256 remainingGrant = tokenGrant.amount - tokenGrant.totalClaimed;
			return remainingGrant;
		} else {
			uint256 vestingDurationInSecs = uint256(tokenGrant.vestingDuration) * SECONDS_PER_DAY;
			uint256 vestingAmountPerSec = tokenGrant.amount / vestingDurationInSecs;
			uint256 amountVested = vestingAmountPerSec * elapsedTime;
			uint256 claimableAmount = amountVested - tokenGrant.totalClaimed;
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
		uint256 elapsedTime = block.timestamp - tokenGrant.startTime;
		uint256 elapsedDays = elapsedTime / SECONDS_PER_DAY;

		if (elapsedDays < tokenGrant.vestingCliff) {
			return 0;
		}

		// If over vesting duration, all tokens vested
		if (elapsedDays >= tokenGrant.vestingDuration) {
			return tokenGrant.amount;
		} else {
			uint256 vestingDurationInSecs = uint256(tokenGrant.vestingDuration) * SECONDS_PER_DAY;
			uint256 vestingAmountPerSec = tokenGrant.amount / vestingDurationInSecs;
			uint256 amountVested = vestingAmountPerSec * elapsedTime;
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
		require(amountVested > 0, "Monastery::claimVested: amountVested is 0");
		votingPower.removeVotingPowerForClaimedTokens(recipient, amountVested);

		Grant storage tokenGrant = tokenGrants[recipient];
		tokenGrant.totalClaimed = uint256(tokenGrant.totalClaimed + amountVested);

		require(token.transfer(recipient, amountVested), "Monastery::claimVested: transfer failed");
		emit GrantTokensClaimed(recipient, amountVested);
	}

	/**
	 * @notice Calculate the number of tokens that will vest per day for the given recipient
	 * @param recipient The address that has a grant
	 * @return Number of tokens that will vest per day
	 */
	function tokensVestedPerDay(address recipient) public view returns (uint256) {
		Grant storage tokenGrant = tokenGrants[recipient];
		return tokenGrant.amount / uint256(tokenGrant.vestingDuration);
	}

	/**
	 * @notice Set voting power contract address
	 * @param newContract New voting power contract address
	 */
	function setVotingPowerContract(address newContract) external onlyTheChurch {
		require(
			newContract != address(0) && newContract != address(this) && newContract != address(token),
			"Monastery::setVotingPowerContract: not valid contract"
		);
		require(
			IVotingPower(newContract).govToken() == address(token),
			"Monastery::setVotingPowerContract: voting power not initialized"
		);

		address oldContract = address(votingPower);
		votingPower = IVotingPower(newContract);
		emit ChangedVotingPower(oldContract, newContract);
	}

	/**
	 * @notice Change clergy of vesting contract
	 * @param newOwner New clergy address
	 */
	function changeClergy(address newOwner) external onlyTheChurch {
		require(
			newOwner != address(0) && newOwner != address(this) && newOwner != address(token),
			"Monastery::changeClergy: not valid address"
		);

		address oldOwner = clergy;
		clergy = newOwner;
		emit ApostolicSuccession(oldOwner, newOwner);
	}
}
