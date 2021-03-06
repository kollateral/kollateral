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

interface IVault {
	struct Lock {
		address token;
		address receiver;
		uint48 startTime;
		uint16 vestingDurationInDays;
		uint16 cliffDurationInDays;
		uint256 amount;
		uint256 amountClaimed;
		uint256 votingPower;
	}

	struct LockBalance {
		uint256 id;
		uint256 claimableAmount;
		Lock lock;
	}

	struct TokenBalance {
		uint256 totalAmount;
		uint256 claimableAmount;
		uint256 claimedAmount;
		uint256 votingPower;
	}

	function lockTokens(
		address token,
		address locker,
		address receiver,
		uint48 startTime,
		uint256 amount,
		uint16 lockDurationInDays,
		uint16 cliffDurationInDays,
		bool grantVotingPower
	) external;

	function lockTokensWithPermit(
		address token,
		address locker,
		address receiver,
		uint48 startTime,
		uint256 amount,
		uint16 lockDurationInDays,
		uint16 cliffDurationInDays,
		bool grantVotingPower,
		uint256 deadline,
		bytes memory signature // Prevents CompilerError: Stack too deep when having more than 11 function parameters
	) external;

	function claimUnlockedTokenAmounts(uint256[] memory lockIds, uint256[] memory amounts) external;

	function claimAllUnlockedTokens(uint256[] memory lockIds) external;

	function allActiveLockIds() external view returns (uint256[] memory);

	function allActiveLocks() external view returns (Lock[] memory);

	function allActiveLockBalances() external view returns (LockBalance[] memory);

	function activeLockIds(address receiver) external view returns (uint256[] memory);

	function allLocks(address receiver) external view returns (Lock[] memory);

	function activeLocks(address receiver) external view returns (Lock[] memory);

	function activeLockBalances(address receiver) external view returns (LockBalance[] memory);

	function totalTokenBalance(address token) external view returns (TokenBalance memory balance);

	function tokenBalance(address token, address receiver) external view returns (TokenBalance memory balance);

	function lockBalance(uint256 lockId) external view returns (LockBalance memory);

	function claimableBalance(uint256 lockId) external view returns (uint256);

	function extendLock(
		uint256 lockId,
		uint16 vestingDaysToAdd,
		uint16 cliffDaysToAdd
	) external;
}
