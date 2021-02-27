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
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.1;

import "./LibDiamondStorage.sol";

library LibCrownStorage {
	bytes32 constant CROWN_STORAGE_POSITION = keccak256("dev.kingmaker.crown.storage");
	//
	// TODO: everything below this point is a placeholder
	//
	struct Checkpoint {
		uint256 timestamp;
		uint256 amount;
	}

	struct Stake {
		uint256 timestamp;
		uint256 amount;
		uint256 expiryTimestamp;
		address delegatedTo;
	}

	struct Storage {
		bool initialized;
		// mapping of user address to history of Stake objects
		// every user action creates a new object in the history
		mapping(address => Stake[]) userStakeHistory;
		// array of bond staked Checkpoint
		// deposits/withdrawals create a new object in the history (max one per block)
		Checkpoint[] bondStakedHistory;
		// mapping of user address to history of delegated power
		// every delegate/stopDelegate call create a new checkpoint (max one per block)
		mapping(address => Checkpoint[]) delegatedPowerHistory;

		//IERC20 bond;
		//IRewards rewards;
	}

	function barnStorage() internal pure returns (Storage storage ds) {
		bytes32 position = CROWN_STORAGE_POSITION;
		assembly {
			ds.slot := position
		}
	}
}
