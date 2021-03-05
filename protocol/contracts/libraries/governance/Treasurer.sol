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

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../libraries/governance/LibCrownStorage.sol";

import "../../interfaces/governance/ILockManager.sol";
import "../../interfaces/governance/IMasterChef.sol";
import "../../interfaces/governance/IVault.sol";

abstract contract Treasurer is ReentrancyGuard {
	using SafeERC20 for IERC20;

	/// @notice Info of each user.
	struct UserInfo {
		// We do some basic math here. Basically, at any point in time, the amount of reward tokens
		// entitled to a user, pending to be distributed, is given by:
		//
		//   pendingReward = (user.amount * pool.accRewardsPerShare) - user.rewardDebt
		//
		// Whenever a user deposits or withdraws tokens to a pool. Here's what happens:
		//   1. The pool's `accRewardsPerShare` (and `lastRewardBlock`) gets updated.
		//   2. User receives the pending reward sent to his/her address.
		//   3. User's `amount` gets updated.
		//   4. User's `rewardDebt` gets updated.
		uint256 amount; // How many tokens the user has provided.
		uint256 rewardTokenDebt; // Reward debt for reward token. See explanation above.
		uint256 sushiRewardDebt; // Reward debt for Sushi rewards. See explanation above.
	}

	/// @notice Info of each pool.
	struct PoolInfo {
		IERC20 token; // Address of token contract.
		uint256 allocPoint; // How many allocation points assigned to this pool. Reward tokens to distribute per block.
		uint256 lastRewardBlock; // Last block number where reward tokens were distributed.
		uint256 accRewardsPerShare; // Accumulated reward tokens per share, times 1e12. See below.
		uint32 vestingPercent; // Percentage of rewards that vest (measured in bips: 500,000 bips = 50% of rewards)
		uint16 vestingPeriod; // Vesting period in days for vesting rewards
		uint16 vestingCliff; // Vesting cliff in days for vesting rewards
		uint256 totalStaked; // Total amount of token staked via Rewards Manager
		bool vpForDeposit; // Should users gain voting power for depositing this token?
		bool vpForVesting; // Should users gain voting power for vesting this token?
	}

	/// @notice Reward token
	IERC20 public rewardToken;

	/// @notice SUSHI token
	IERC20 public sushiToken;

	/// @notice Sushi Master Chef
	IMasterChef public masterChef;

	/// @notice Vault for vesting tokens
	IVault public vault;

	/// @notice LockManager contract
	ILockManager public lockManager;

	/// @notice Reward tokens rewarded per block.
	uint256 public rewardTokensPerBlock;

	/// @notice Info of each pool.
	PoolInfo[] public poolInfo;

	/// @notice Mapping of Sushi tokens to MasterChef pids
	mapping(address => uint256) public sushiPools;

	/// @notice Info of each user that stakes tokens.
	mapping(uint256 => mapping(address => UserInfo)) public userInfo;

	/// @notice Total allocation points. Must be the sum of all allocation points in all pools.
	uint256 public totalAllocPoint;

	/// @notice The block number when rewards start.
	uint256 public startBlock;

	/// @notice The block number when rewards end.
	uint256 public endBlock;

	/// @notice Current master of this contract
	address public master;

	/// @notice Event emitted when a user deposits funds in the rewards manager
	event Deposit(address indexed user, uint256 indexed pid, uint256 amount);

	/// @notice Event emitted when a user withdraws their original funds + rewards from the rewards manager
	event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);

	/// @notice Event emitted when a user withdraws their original funds from the rewards manager without claiming rewards
	event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

	/// @notice Event emitted when new pool is added to the rewards manager
	event PoolAdded(
		uint256 indexed pid,
		address indexed token,
		uint256 allocPoints,
		uint256 totalAllocPoints,
		uint256 rewardStartBlock,
		uint256 sushiPid,
		bool vpForDeposit,
		bool vpForVesting
	);

	/// @notice Event emitted when pool allocation points are updated
	event PoolUpdated(uint256 indexed pid, uint256 oldAllocPoints, uint256 newAllocPoints, uint256 newTotalAllocPoints);

	/// @notice Event emitted when the master of the rewards manager contract is updated
	event ChangedMaster(address indexed oldMaster, address indexed newMaster);

	/// @notice Event emitted when the amount of reward tokens per block is updated
	event ChangedRewardTokensPerBlock(uint256 indexed oldRewardTokensPerBlock, uint256 indexed newRewardTokensPerBlock);

	/// @notice Event emitted when the rewards start block is set
	event SetRewardsStartBlock(uint256 indexed startBlock);

	/// @notice Event emitted when the rewards end block is updated
	event ChangedRewardsEndBlock(uint256 indexed oldEndBlock, uint256 indexed newEndBlock);

	/// @notice Event emitted when contract address is changed
	event ChangedAddress(string indexed addressType, address indexed oldAddress, address indexed newAddress);

	/// @notice restrict functions to just master address
	modifier onlyMaster {
		CrownStorage storage crown = LibCrownStorage.crownStorage();
		require(crown.king == address(0) || msg.sender == crown.king, "Crown::onlyMaster: not the king");
		_;
	}

	/**
	 * @notice View function to see current poolInfo array length
	 * @return pool length
	 */
	function poolLength() external view returns (uint256) {
		return poolInfo.length;
	}

	/**
	 * @notice Add a new reward token to the pool
	 * @dev Can only be called by the master. DO NOT add the same token more than once. Rewards will be messed up if you do.
	 * @param allocPoint Number of allocation points to allot to this token/pool
	 * @param token The token that will be staked for rewards
	 * @param vestingPercent The percentage of rewards from this pool that will vest
	 * @param vestingPeriod The number of days for the vesting period
	 * @param vestingCliff The number of days for the vesting cliff
	 * @param withUpdate if specified, update all pools before adding new pool
	 * @param sushiPid The pid of the Sushiswap pool in the Masterchef contract (if exists, otherwise provide zero)
	 * @param vpForDeposit If true, users get voting power for deposits
	 * @param vpForVesting If true, users get voting power for vesting balances
	 */
	function add(
		uint256 allocPoint,
		address token,
		uint32 vestingPercent,
		uint16 vestingPeriod,
		uint16 vestingCliff,
		bool withUpdate,
		uint256 sushiPid,
		bool vpForDeposit,
		bool vpForVesting
	) external onlyMaster {
		if (withUpdate) {
			massUpdatePools();
		}
		uint256 rewardStartBlock = block.number > startBlock ? block.number : startBlock;
		if (totalAllocPoint == 0) {
			_setRewardsEndBlock();
		}
		totalAllocPoint = totalAllocPoint + allocPoint;
		poolInfo.push(
			PoolInfo({
				token: IERC20(token),
				allocPoint: allocPoint,
				lastRewardBlock: rewardStartBlock,
				accRewardsPerShare: 0,
				vestingPercent: vestingPercent,
				vestingPeriod: vestingPeriod,
				vestingCliff: vestingCliff,
				totalStaked: 0,
				vpForDeposit: vpForDeposit,
				vpForVesting: vpForVesting
			})
		);
		if (sushiPid != uint256(0)) {
			sushiPools[token] = sushiPid;
			IERC20(token).safeIncreaseAllowance(address(masterChef), type(uint256).max);
		}
		IERC20(token).safeIncreaseAllowance(address(vault), type(uint256).max);
		emit PoolAdded(
			poolInfo.length - 1,
			token,
			allocPoint,
			totalAllocPoint,
			rewardStartBlock,
			sushiPid,
			vpForDeposit,
			vpForVesting
		);
	}

	/**
	 * @notice Update the given pool's allocation points
	 * @dev Can only be called by the master
	 * @param pid The RewardManager pool id
	 * @param allocPoint New number of allocation points for pool
	 * @param withUpdate if specified, update all pools before setting allocation points
	 */
	function set(
		uint256 pid,
		uint256 allocPoint,
		bool withUpdate
	) external onlyMaster {
		if (withUpdate) {
			massUpdatePools();
		}
		totalAllocPoint = totalAllocPoint - poolInfo[pid].allocPoint + allocPoint;
		emit PoolUpdated(pid, poolInfo[pid].allocPoint, allocPoint, totalAllocPoint);
		poolInfo[pid].allocPoint = allocPoint;
	}

	/**
	 * @notice View function to see pending reward tokens on frontend.
	 * @param pid pool id
	 * @param account user account to check
	 * @return pending rewards
	 */
	function pendingRewardTokens(uint256 pid, address account) external view returns (uint256) {
		PoolInfo storage pool = poolInfo[pid];
		UserInfo storage user = userInfo[pid][account];
		uint256 accRewardsPerShare = pool.accRewardsPerShare;
		uint256 tokenSupply = pool.totalStaked;
		if (block.number > pool.lastRewardBlock && tokenSupply != 0) {
			uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
			uint256 totalReward = (multiplier * rewardTokensPerBlock * pool.allocPoint) / totalAllocPoint;
			accRewardsPerShare = accRewardsPerShare + (totalReward * 1e12) / tokenSupply;
		}

		uint256 accumulatedRewards = (user.amount * accRewardsPerShare) / 1e12;

		if (accumulatedRewards < user.rewardTokenDebt) {
			return 0;
		}

		return accumulatedRewards - user.rewardTokenDebt;
	}

	/**
	 * @notice View function to see pending SUSHI on frontend.
	 * @param pid pool id
	 * @param account user account to check
	 * @return pending SUSHI rewards
	 */
	function pendingSushi(uint256 pid, address account) external view returns (uint256) {
		PoolInfo storage pool = poolInfo[pid];
		UserInfo storage user = userInfo[pid][account];
		uint256 sushiPid = sushiPools[address(pool.token)];
		if (sushiPid == uint256(0)) {
			return 0;
		}
		IMasterChef.PoolInfo memory sushiPool = masterChef.poolInfo(sushiPid);
		uint256 sushiPerBlock = masterChef.sushiPerBlock();
		uint256 totalSushiAllocPoint = masterChef.totalAllocPoint();
		uint256 accSushiPerShare = sushiPool.accSushiPerShare;
		uint256 lpSupply = sushiPool.lpToken.balanceOf(address(masterChef));
		if (block.number > sushiPool.lastRewardBlock && lpSupply != 0) {
			uint256 multiplier = masterChef.getMultiplier(sushiPool.lastRewardBlock, block.number);
			uint256 sushiReward = (multiplier * sushiPerBlock * sushiPool.allocPoint) / totalSushiAllocPoint;
			accSushiPerShare = accSushiPerShare + (sushiReward * 1e12) / lpSupply;
		}

		uint256 accumulatedSushi = (user.amount * accSushiPerShare) / 1e12;

		if (accumulatedSushi < user.sushiRewardDebt) {
			return 0;
		}

		return accumulatedSushi - user.sushiRewardDebt;
	}

	/**
	 * @notice Update reward variables for all pools
	 * @dev Be careful of gas spending!
	 */
	function massUpdatePools() public {
		for (uint256 pid = 0; pid < poolInfo.length; ++pid) {
			updatePool(pid);
		}
	}

	/**
	 * @notice Update reward variables of the given pool to be up-to-date
	 * @param pid pool id
	 */
	function updatePool(uint256 pid) public {
		PoolInfo storage pool = poolInfo[pid];
		if (block.number <= pool.lastRewardBlock) {
			return;
		}

		uint256 tokenSupply = pool.totalStaked;
		if (tokenSupply == 0) {
			pool.lastRewardBlock = block.number;
			return;
		}
		uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
		uint256 totalReward = (multiplier * rewardTokensPerBlock * pool.allocPoint) / totalAllocPoint;
		pool.accRewardsPerShare = pool.accRewardsPerShare + (totalReward * 1e12) / tokenSupply;
		pool.lastRewardBlock = block.number;
	}

	/**
	 * @notice Deposit tokens to Dragon for rewards allocation.
	 * @param pid pool id
	 * @param amount number of tokens to deposit
	 */
	function deposit(uint256 pid, uint256 amount) external nonReentrant {
		PoolInfo storage pool = poolInfo[pid];
		UserInfo storage user = userInfo[pid][msg.sender];
		_deposit(pid, amount, pool, user);
	}

	/**
	 * @notice Deposit tokens to Dragon for rewards allocation, using permit for approval
	 * @dev It is up to the frontend developer to ensure the pool token implements permit - otherwise this will fail
	 * @param pid pool id
	 * @param amount number of tokens to deposit
	 * @param deadline The time at which to expire the signature
	 * @param v The recovery byte of the signature
	 * @param r Half of the ECDSA signature pair
	 * @param s Half of the ECDSA signature pair

	function depositWithPermit(
		uint256 pid,
		uint256 amount,
		uint256 deadline,
		uint8 v,
		bytes32 r,
		bytes32 s
	) external nonReentrant {
		PoolInfo storage pool = poolInfo[pid];
		UserInfo storage user = userInfo[pid][msg.sender];
		// TODO: find the best way to provide a richer ERC20 interface here
		// pool.token.permit(msg.sender, address(this), amount, deadline, v, r, s);
		// _deposit(pid, amount, pool, user);
		console.log("Dragon::depositWithPermit: not supported atm");
	}*/

	/**
	 * @notice Withdraw tokens from Dragon, claiming rewards.
	 * @param pid pool id
	 * @param amount number of tokens to withdraw
	 */
	function withdraw(uint256 pid, uint256 amount) external nonReentrant {
		require(amount > 0, "Dragon::withdraw: amount must be > 0");
		PoolInfo storage pool = poolInfo[pid];
		UserInfo storage user = userInfo[pid][msg.sender];
		_withdraw(pid, amount, pool, user);
	}

	/**
	 * @notice Set approvals for external addresses to use contract tokens
	 * @dev Can only be called by the master
	 * @param tokensToApprove the tokens to approve
	 * @param approvalAmounts the token approval amounts
	 * @param spender the address to allow spending of token
	 */
	function tokenAllow(
		address[] memory tokensToApprove,
		uint256[] memory approvalAmounts,
		address spender
	) external onlyMaster {
		require(tokensToApprove.length == approvalAmounts.length, "Dragon::tokenAllow: not same length");
		for (uint256 i = 0; i < tokensToApprove.length; i++) {
			IERC20 token = IERC20(tokensToApprove[i]);
			if (token.allowance(address(this), spender) != type(uint256).max) {
				token.safeApprove(spender, approvalAmounts[i]);
			}
		}
	}

	/**
	 * @notice Rescue (withdraw) tokens from the smart contract
	 * @dev Can only be called by the master
	 * @param tokens the tokens to withdraw
	 * @param amounts the amount of each token to withdraw.  If zero, withdraws the maximum allowed amount for each token
	 * @param receiver the address that will receive the tokens
	 * @param updateRewardsEndBlock if true, update the rewards end block after performing transfers
	 */
	function rescueTokens(
		address[] calldata tokens,
		uint256[] calldata amounts,
		address receiver,
		bool updateRewardsEndBlock
	) external onlyMaster {
		require(tokens.length == amounts.length, "Dragon::rescueTokens: not same length");
		for (uint256 i = 0; i < tokens.length; i++) {
			IERC20 token = IERC20(tokens[i]);
			uint256 withdrawalAmount;
			uint256 tokenBalance = token.balanceOf(address(this));
			uint256 tokenAllowance = token.allowance(address(this), receiver);
			if (amounts[i] == 0) {
				if (tokenBalance > tokenAllowance) {
					withdrawalAmount = tokenAllowance;
				} else {
					withdrawalAmount = tokenBalance;
				}
			} else {
				require(tokenBalance >= amounts[i], "Dragon::rescueTokens: contract balance too low");
				require(tokenAllowance >= amounts[i], "Dragon::rescueTokens: increase token allowance");
				withdrawalAmount = amounts[i];
			}
			token.safeTransferFrom(address(this), receiver, withdrawalAmount);
		}

		if (updateRewardsEndBlock) {
			_setRewardsEndBlock();
		}
	}

	/**
	 * @notice Withdraw without caring about rewards. EMERGENCY ONLY.
	 * @param pid pool id
	 */
	function emergencyWithdraw(uint256 pid) external nonReentrant {
		PoolInfo storage pool = poolInfo[pid];
		UserInfo storage user = userInfo[pid][msg.sender];

		if (user.amount > 0) {
			uint256 sushiPid = sushiPools[address(pool.token)];
			if (sushiPid != uint256(0)) {
				masterChef.withdraw(sushiPid, user.amount);
			}

			if (pool.vpForDeposit) {
				lockManager.removeVotingPower(msg.sender, address(pool.token), user.amount);
			}

			pool.totalStaked = pool.totalStaked - user.amount;
			pool.token.safeTransfer(msg.sender, user.amount);

			emit EmergencyWithdraw(msg.sender, pid, user.amount);

			user.amount = 0;
			user.rewardTokenDebt = 0;
			user.sushiRewardDebt = 0;
		}
	}

	/**
	 * @notice Add rewards to contract
	 * @dev Can only be called by the master
	 * @param amount amount of tokens to add
	 */
	function addRewardsBalance(uint256 amount) external onlyMaster {
		rewardToken.safeTransferFrom(msg.sender, address(this), amount);
		_setRewardsEndBlock();
	}

	/**
	 * @notice Reset rewards end block manually based on new balances
	 */
	function resetRewardsEndBlock() external onlyMaster {
		_setRewardsEndBlock();
	}

	/**
	 * @notice Returns true if rewards are actively being accumulated
	 */
	function rewardsActive() public view returns (bool) {
		return block.number >= startBlock && block.number <= endBlock && totalAllocPoint > 0 ? true : false;
	}

	/**
	 * @notice Return reward multiplier over the given from to to block.
	 * @param from From block number
	 * @param to To block number
	 * @return multiplier
	 */
	function getMultiplier(uint256 from, uint256 to) public view returns (uint256) {
		uint256 toBlock = to > endBlock ? endBlock : to;
		return toBlock > from ? toBlock - from : 0;
	}

	/**
	 * @notice Internal implementation of deposit
	 * @param pid pool id
	 * @param amount number of tokens to deposit
	 * @param pool the pool info
	 * @param user the user info
	 */
	function _deposit(
		uint256 pid,
		uint256 amount,
		PoolInfo storage pool,
		UserInfo storage user
	) internal {
		updatePool(pid);

		uint256 sushiPid = sushiPools[address(pool.token)];
		uint256 pendingSushiTokens = 0;

		if (user.amount > 0) {
			uint256 pendingRewards = (user.amount * pool.accRewardsPerShare) / 1e12 - user.rewardTokenDebt;

			if (pendingRewards > 0) {
				_distributeRewards(
					msg.sender,
					pendingRewards,
					pool.vestingPercent,
					pool.vestingPeriod,
					pool.vestingCliff,
					pool.vpForVesting
				);
			}

			if (sushiPid != uint256(0)) {
				masterChef.updatePool(sushiPid);
				pendingSushiTokens =
					(user.amount * masterChef.poolInfo(sushiPid).accSushiPerShare) /
					1e12 -
					user.sushiRewardDebt;
			}
		}

		pool.token.safeTransferFrom(msg.sender, address(this), amount);
		pool.totalStaked = pool.totalStaked + amount;
		user.amount = user.amount + amount;
		user.rewardTokenDebt = (user.amount * pool.accRewardsPerShare) / 1e12;

		if (sushiPid != uint256(0)) {
			masterChef.updatePool(sushiPid);
			user.sushiRewardDebt = (user.amount * masterChef.poolInfo(sushiPid).accSushiPerShare) / 1e12;
			masterChef.deposit(sushiPid, amount);
		}

		if (amount > 0 && pool.vpForDeposit) {
			lockManager.grantVotingPower(msg.sender, address(pool.token), amount);
		}

		if (pendingSushiTokens > 0) {
			_safeSushiTransfer(msg.sender, pendingSushiTokens);
		}

		emit Deposit(msg.sender, pid, amount);
	}

	/**
	 * @notice Internal implementation of withdraw
	 * @param pid pool id
	 * @param amount number of tokens to withdraw
	 * @param pool the pool info
	 * @param user the user info
	 */
	function _withdraw(
		uint256 pid,
		uint256 amount,
		PoolInfo storage pool,
		UserInfo storage user
	) internal {
		require(user.amount >= amount, "Dragon::_withdraw: amount > user balance");

		updatePool(pid);

		uint256 sushiPid = sushiPools[address(pool.token)];

		if (sushiPid != uint256(0)) {
			masterChef.updatePool(sushiPid);
			uint256 pendingSushiTokens =
				(user.amount * masterChef.poolInfo(sushiPid).accSushiPerShare) / 1e12 - user.sushiRewardDebt;
			masterChef.withdraw(sushiPid, amount);
			user.sushiRewardDebt = user.amount - (amount * masterChef.poolInfo(sushiPid).accSushiPerShare) / 1e12;
			if (pendingSushiTokens > 0) {
				_safeSushiTransfer(msg.sender, pendingSushiTokens);
			}
		}

		uint256 pendingRewards = (user.amount * pool.accRewardsPerShare) / 1e12 - user.rewardTokenDebt;
		user.amount = user.amount - amount;
		user.rewardTokenDebt = (user.amount * pool.accRewardsPerShare) / 1e12;

		if (pendingRewards > 0) {
			_distributeRewards(
				msg.sender,
				pendingRewards,
				pool.vestingPercent,
				pool.vestingPeriod,
				pool.vestingCliff,
				pool.vpForVesting
			);
		}

		if (pool.vpForDeposit) {
			lockManager.removeVotingPower(msg.sender, address(pool.token), amount);
		}

		pool.totalStaked = pool.totalStaked - amount;
		pool.token.safeTransfer(msg.sender, amount);

		emit Withdraw(msg.sender, pid, amount);
	}

	/**
	 * @notice Internal function used to distribute rewards, optionally vesting a %
	 * @param account account that is due rewards
	 * @param amount amount of rewards to distribute
	 * @param vestingPercent percent of rewards to vest in bips
	 * @param vestingPeriod number of days over which to vest rewards
	 * @param vestingCliff number of days for vesting cliff
	 * @param vestingVotingPower if true, grant voting power for vesting balance
	 */
	function _distributeRewards(
		address account,
		uint256 amount,
		uint32 vestingPercent,
		uint16 vestingPeriod,
		uint16 vestingCliff,
		bool vestingVotingPower
	) internal {
		uint256 rewardAmount =
			amount > rewardToken.balanceOf(address(this)) ? rewardToken.balanceOf(address(this)) : amount;
		uint256 vestingRewards = (rewardAmount * vestingPercent) / 1000000;
		vault.lockTokens(
			address(rewardToken),
			address(this),
			account,
			0,
			vestingRewards,
			vestingPeriod,
			vestingCliff,
			vestingVotingPower
		);
		_safeRewardsTransfer(msg.sender, rewardAmount - vestingRewards);
	}

	/**
	 * @notice Safe reward transfer function, just in case if rounding error causes pool to not have enough reward token.
	 * @param to account that is receiving rewards
	 * @param amount amount of rewards to send
	 */
	function _safeRewardsTransfer(address to, uint256 amount) internal {
		uint256 rewardTokenBalance = rewardToken.balanceOf(address(this));
		if (amount > rewardTokenBalance) {
			rewardToken.safeTransfer(to, rewardTokenBalance);
		} else {
			rewardToken.safeTransfer(to, amount);
		}
	}

	/**
	 * @notice Safe SUSHI transfer function, just in case if rounding error causes pool to not have enough SUSHI.
	 * @param to account that is receiving SUSHI
	 * @param amount amount of SUSHI to send
	 */
	function _safeSushiTransfer(address to, uint256 amount) internal {
		uint256 sushiBalance = sushiToken.balanceOf(address(this));
		if (amount > sushiBalance) {
			sushiToken.safeTransfer(to, sushiBalance);
		} else {
			sushiToken.safeTransfer(to, amount);
		}
	}

	/**
	 * @notice Internal function that updates rewards end block based on tokens per block and the token balance
	 *         of the contract
	 */
	function _setRewardsEndBlock() internal {
		if (rewardTokensPerBlock > 0) {
			uint256 rewardFromBlock = block.number >= startBlock ? block.number : startBlock;
			uint256 newEndBlock = rewardFromBlock + rewardToken.balanceOf(address(this)) / rewardTokensPerBlock;
			if (newEndBlock > rewardFromBlock && newEndBlock != endBlock) {
				emit ChangedRewardsEndBlock(endBlock, newEndBlock);
				endBlock = newEndBlock;
			}
		}
	}
}
