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

import "../token/ERC20/IERC20.sol";

// TODO: this should be modified to permanently lock liquidity (see https://github.com/ARM-Finance/kingmaker/issues/15)
interface IMasterChef {
	struct PoolInfo {
		IERC20 lpToken; // Address of LP token contract.
		uint256 allocPoint; // How many allocation points assigned to this pool. SUSHIs to distribute per block.
		uint256 lastRewardBlock; // Last block number that SUSHIs distribution occurs.
		uint256 accSushiPerShare; // Accumulated SUSHIs per share, times 1e12.
	}

	function deposit(uint256 _pid, uint256 _amount) external;

	function withdraw(uint256 _pid, uint256 _amount) external;

	function poolInfo(uint256 _pid) external view returns (PoolInfo memory);

	function pendingSushi(uint256 _pid, address _user) external view returns (uint256);

	function updatePool(uint256 _pid) external;

	function sushiPerBlock() external view returns (uint256);

	function totalAllocPoint() external view returns (uint256);

	function getMultiplier(uint256 _from, uint256 _to) external view returns (uint256);
}
