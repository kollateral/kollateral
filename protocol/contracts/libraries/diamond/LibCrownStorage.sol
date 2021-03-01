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
pragma solidity ^0.8.1;

import "../../interfaces/governance/ICrownGovernanceToken.sol";
import "../../interfaces/governance/IVesting.sol";
import "../../interfaces/governance/ITokenRegistry.sol";

/// @notice Crown governance storage
struct CrownStorage {
	// A record of states for signing / validating signatures
	mapping(address => uint256) nonces;
	// Crown governance token
	ICrownGovernanceToken govToken;
	// Vesting contract
	IVesting vesting;
	// Voting Power owner
	address owner;
	// lockManager contract
	address lockManager;
	// Token registry contract
	ITokenRegistry tokenRegistry;
}

/// @notice A checkpoint for marking number of votes from a given block
struct Checkpoint {
	uint32 fromBlock;
	uint256 votes;
}

/// @notice All storage variables related to checkpoints
struct CheckpointStorage {
	// A record of vote checkpoints for each account, by index
	mapping(address => mapping(uint32 => Checkpoint)) checkpoints;
	// The number of checkpoints for each account
	mapping(address => uint32) numCheckpoints;
}

/// @notice The amount of a given token that has been staked, and the resulting voting power
struct Stake {
	uint256 amount;
	uint256 votingPower;
	// TODO: ?
	// uint256 expiryTimestamp;
	// address delegatedTo;
}

/// @notice All storage variables related to staking
struct StakeStorage {
	// Official record of staked balances for each account > token > stake
	mapping(address => mapping(address => Stake)) stakes;
}

library LibCrownStorage {
	bytes32 constant CROWN_GOVERNANCE_STORAGE = keccak256("kingmaker.crown.governance.storage");
	bytes32 constant CROWN_CHECKPOINT_STORAGE = keccak256("kingmaker.crown.checkpoint.storage");
	bytes32 constant CROWN_STAKE_STORAGE = keccak256("kingmaker.crown.stake.storage");

	/**
	 * @notice Load app storage struct from specified VOTING_POWER_APP_STORAGE_POSITION
	 * @return crown CrownGovernance struct
	 */
	function govStorage() internal pure returns (CrownStorage storage crown) {
		bytes32 position = CROWN_GOVERNANCE_STORAGE;
		assembly {
			crown.slot := position
		}
	}

	/**
	 * @notice Load checkpoint storage struct from specified VOTING_POWER_CHECKPOINT_STORAGE_POSITION
	 * @return cs CheckpointStorage struct
	 */
	function checkpointStorage() internal pure returns (CheckpointStorage storage cs) {
		bytes32 position = CROWN_CHECKPOINT_STORAGE;
		assembly {
			cs.slot := position
		}
	}

	/**
	 * @notice Load stake storage struct from specified VOTING_POWER_STAKE_STORAGE_POSITION
	 * @return ss StakeStorage struct
	 */
	function stakeStorage() internal pure returns (StakeStorage storage ss) {
		bytes32 position = CROWN_STAKE_STORAGE;
		assembly {
			ss.slot := position
		}
	}
}
