/*

	Copyright (c) [2020] [Archer DAO]
    Copyright 2020-2021 ARM Finance LLC

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by crownlicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/
// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.1;

import "hardhat/console.sol";

import "../../libraries/diamond/LibCrownStorage.sol";
import "../../interfaces/token/ERC20/IERC20.sol";

import "../../interfaces/governance/IVotingPowerFormula.sol";
import "../../libraries/governance/PrismProxyImplementation.sol";
import "../../libraries/math/SafeMath.sol";
import "../../libraries/security/ReentrancyGuardUpgradeSafe.sol";
import "../../libraries/token/ERC20/utils/SafeERC20.sol";

/**
 * @title VotingPower
 * @dev Implementation contract for voting power prism proxy
 * Calls should not be made directly to this contract, instead make calls to the VotingPowerPrism proxy contract
 * The exception to this is the `become` function specified in PrismProxyImplementation
 * This function is called once and is used by this contract to accept its role as the implementation for the prism proxy
 */
contract VotingPower is PrismProxyImplementation, ReentrancyGuardUpgradeSafe {
	using SafeMath for uint256;
	using SafeERC20 for IERC20;

	/// @notice An event that's emitted when a user's staked balance increases
	event Staked(address indexed user, address indexed token, uint256 indexed amount, uint256 votingPower);

	/// @notice An event that's emitted when a user's staked balance decreases
	event Withdrawn(address indexed user, address indexed token, uint256 indexed amount, uint256 votingPower);

	/// @notice An event that's emitted when an account's vote balance changes
	event VotingPowerChanged(address indexed voter, uint256 indexed previousBalance, uint256 indexed newBalance);

	/// @notice Event emitted when the owner of the voting power contract is updated
	event ChangedOwner(address indexed oldOwner, address indexed newOwner);

	/// @notice restrict functions to just owner address
	modifier onlyOwner {
		CrownStorage storage crown = LibCrownStorage.govStorage();
		require(crown.owner == address(0) || msg.sender == crown.owner, "only owner");
		_;
	}

	/**
	 * @notice Initialize VotingPower contract
	 * @dev Should be called via VotingPowerPrism before calling anything else
	 * @param _govToken address of KING token
	 * @param _vestingContract address of Vesting contract
	 */
	function initialize(address _govToken, address _vestingContract) public initializer {
		__ReentrancyGuard_init_unchained();
		CrownStorage storage crown = LibCrownStorage.govStorage();
		crown.govToken = ICrownGovernanceToken(_govToken);
		crown.vesting = IVesting(_vestingContract);
	}

	/**
	 * @notice Address of KING token
	 * @return Address of KING token
	 */
	function govToken() public view returns (address) {
		CrownStorage storage crown = LibCrownStorage.govStorage();
		return address(crown.govToken);
	}

	/**
	 * @notice Decimals used for voting power
	 * @return decimals
	 */
	function decimals() public pure returns (uint8) {
		return 18;
	}

	/**
	 * @notice Address of vesting contract
	 * @return Address of vesting contract
	 */
	function vestingContract() public view returns (address) {
		CrownStorage storage crown = LibCrownStorage.govStorage();
		return address(crown.vesting);
	}

	/**
	 * @notice Address of token registry
	 * @return Address of token registry
	 */
	function tokenRegistry() public view returns (address) {
		CrownStorage storage crown = LibCrownStorage.govStorage();
		return address(crown.tokenRegistry);
	}

	/**
	 * @notice Address of lockManager
	 * @return Address of lockManager
	 */
	function lockManager() public view returns (address) {
		CrownStorage storage crown = LibCrownStorage.govStorage();
		return crown.lockManager;
	}

	/**
	 * @notice Address of owner
	 * @return Address of owner
	 */
	function owner() public view returns (address) {
		CrownStorage storage crown = LibCrownStorage.govStorage();
		return crown.owner;
	}

	/**
	 * @notice Sets token registry address
	 * @param registry Address of token registry
	 */
	function setTokenRegistry(address registry) public onlyOwner {
		CrownStorage storage crown = LibCrownStorage.govStorage();
		crown.tokenRegistry = ITokenRegistry(registry);
	}

	/**
	 * @notice Sets lockManager address
	 * @param newLockManager Address of lockManager
	 */
	function setLockManager(address newLockManager) public onlyOwner {
		CrownStorage storage crown = LibCrownStorage.govStorage();
		crown.lockManager = newLockManager;
	}

	/**
	 * @notice Change owner of vesting contract
	 * @param newOwner New owner address
	 */
	function changeOwner(address newOwner) external onlyOwner {
		require(newOwner != address(0) && newOwner != address(this), "VP::changeOwner: not valid address");
		CrownStorage storage crown = LibCrownStorage.govStorage();
		emit ChangedOwner(crown.owner, newOwner);
		crown.owner = newOwner;
	}

	/**
	 * @notice Stake KING tokens using offchain approvals to unlock voting power
	 * @param amount The amount to stake
	 * @param deadline The time at which to expire the signature
	 * @param v The recovery byte of the signature
	 * @param r Half of the ECDSA signature pair
	 * @param s Half of the ECDSA signature pair
	 */
	function stakeWithPermit(
		uint256 amount,
		uint256 deadline,
		uint8 v,
		bytes32 r,
		bytes32 s
	) external nonReentrant {
		require(amount > 0, "VP::stakeWithPermit: cannot stake 0");
		CrownStorage storage crown = LibCrownStorage.govStorage();
		require(crown.govToken.balanceOf(msg.sender) >= amount, "VP::stakeWithPermit: not enough tokens");

		crown.govToken.permit(msg.sender, address(this), amount, deadline, v, r, s);

		_stake(msg.sender, address(crown.govToken), amount, amount);
	}

	/**
	 * @notice Stake KING tokens to unlock voting power for `msg.sender`
	 * @param amount The amount to stake
	 */
	function stake(uint256 amount) external nonReentrant {
		CrownStorage storage crown = LibCrownStorage.govStorage();
		require(amount > 0, "VP::stake: cannot stake 0");
		require(crown.govToken.balanceOf(msg.sender) >= amount, "VP::stake: not enough tokens");
		require(
			crown.govToken.allowance(msg.sender, address(this)) >= amount,
			"VP::stake: must crownrove tokens before staking"
		);

		_stake(msg.sender, address(crown.govToken), amount, amount);
	}

	/**
	 * @notice Stake LP tokens to unlock voting power for `msg.sender`
	 * @param token The token to stake
	 * @param amount The amount to stake
	 */
	function stake(address token, uint256 amount) external nonReentrant {
		IERC20 lptoken = IERC20(token);
		require(amount > 0, "VP::stake: cannot stake 0");
		require(lptoken.balanceOf(msg.sender) >= amount, "VP::stake: not enough tokens");
		require(
			lptoken.allowance(msg.sender, address(this)) >= amount,
			"VP::stake: must crownrove tokens before staking"
		);

		CrownStorage storage crown = LibCrownStorage.govStorage();
		address tokenFormulaAddress = crown.tokenRegistry.tokenFormulas(token);
		require(tokenFormulaAddress != address(0), "VP::stake: token not supported");

		IVotingPowerFormula tokenFormula = IVotingPowerFormula(tokenFormulaAddress);
		uint256 votingPower = tokenFormula.convertTokensToVotingPower(amount);
		_stake(msg.sender, token, amount, votingPower);
	}

	/**
	 * @notice Count vesting KING tokens toward voting power for `account`
	 * @param account The recipient of voting power
	 * @param amount The amount of voting power to add
	 */
	function addVotingPowerForVestingTokens(address account, uint256 amount) external nonReentrant {
		CrownStorage storage crown = LibCrownStorage.govStorage();
		require(amount > 0, "VP::addVPforVT: cannot add 0 voting power");
		require(msg.sender == address(crown.vesting), "VP::addVPforVT: only vesting contract");

		_increaseVotingPower(account, amount);
	}

	/**
	 * @notice Remove claimed vesting KING tokens from voting power for `account`
	 * @param account The account with voting power
	 * @param amount The amount of voting power to remove
	 */
	function removeVotingPowerForClaimedTokens(address account, uint256 amount) external nonReentrant {
		CrownStorage storage crown = LibCrownStorage.govStorage();
		require(amount > 0, "VP::removeVPforCT: cannot remove 0 voting power");
		require(msg.sender == address(crown.vesting), "VP::removeVPforCT: only vesting contract");

		_decreaseVotingPower(account, amount);
	}

	/**
	 * @notice Count locked tokens toward voting power for `account`
	 * @param account The recipient of voting power
	 * @param amount The amount of voting power to add
	 */
	function addVotingPowerForLockedTokens(address account, uint256 amount) external nonReentrant {
		CrownStorage storage crown = LibCrownStorage.govStorage();
		require(amount > 0, "VP::addVPforLT: cannot add 0 voting power");
		require(msg.sender == crown.lockManager, "VP::addVPforLT: only lockManager contract");

		_increaseVotingPower(account, amount);
	}

	/**
	 * @notice Remove unlocked tokens from voting power for `account`
	 * @param account The account with voting power
	 * @param amount The amount of voting power to remove
	 */
	function removeVotingPowerForUnlockedTokens(address account, uint256 amount) external nonReentrant {
		CrownStorage storage crown = LibCrownStorage.govStorage();
		require(amount > 0, "VP::removeVPforUT: cannot remove 0 voting power");
		require(msg.sender == crown.lockManager, "VP::removeVPforUT: only lockManager contract");

		_decreaseVotingPower(account, amount);
	}

	/**
	 * @notice Withdraw staked KING tokens, removing voting power for `msg.sender`
	 * @param amount The amount to withdraw
	 */
	function withdraw(uint256 amount) external nonReentrant {
		require(amount > 0, "VP::withdraw: cannot withdraw 0");
		CrownStorage storage crown = LibCrownStorage.govStorage();
		_withdraw(msg.sender, address(crown.govToken), amount, amount);
	}

	/**
	 * @notice Withdraw staked LP tokens, removing voting power for `msg.sender`
	 * @param token The token to withdraw
	 * @param amount The amount to withdraw
	 */
	function withdraw(address token, uint256 amount) external nonReentrant {
		require(amount > 0, "VP::withdraw: cannot withdraw 0");
		Stake memory s = getStake(msg.sender, token);
		uint256 vpToWithdraw = amount.mul(s.votingPower).div(s.amount);
		_withdraw(msg.sender, token, amount, vpToWithdraw);
	}

	/**
	 * @notice Get total amount of KING tokens staked in contract by `staker`
	 * @param staker The user with staked KING
	 * @return total KING amount staked
	 */
	function getKINGAmountStaked(address staker) public view returns (uint256) {
		return getKINGStake(staker).amount;
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
	 * @notice Get staked amount and voting power from KING tokens staked in contract by `staker`
	 * @param staker The user with staked KING
	 * @return total KING staked
	 */
	function getKINGStake(address staker) public view returns (Stake memory) {
		CrownStorage storage crown = LibCrownStorage.govStorage();
		return getStake(staker, address(crown.govToken));
	}

	/**
	 * @notice Get total staked amount and voting power from `stakedToken` staked in contract by `staker`
	 * @param staker The user with staked tokens
	 * @param stakedToken The staked token
	 * @return total staked
	 */
	function getStake(address staker, address stakedToken) public view returns (Stake memory) {
		StakeStorage storage ss = LibCrownStorage.stakeStorage();
		return ss.stakes[staker][stakedToken];
	}

	/**
	 * @notice Gets the current votes balance for `account`
	 * @param account The address to get votes balance
	 * @return The number of current votes for `account`
	 */
	function balanceOf(address account) public view returns (uint256) {
		CheckpointStorage storage cs = LibCrownStorage.checkpointStorage();
		uint32 nCheckpoints = cs.numCheckpoints[account];
		return nCheckpoints > 0 ? cs.checkpoints[account][nCheckpoints - 1].votes : 0;
	}

	/**
	 * @notice Determine the prior number of votes for an account as of a block number
	 * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
	 * @param account The address of the account to check
	 * @param blockNumber The block number to get the vote balance at
	 * @return The number of votes the account had as of the given block
	 */
	function balanceOfAt(address account, uint256 blockNumber) public view returns (uint256) {
		require(blockNumber < block.number, "VP::balanceOfAt: not yet determined");

		CheckpointStorage storage cs = LibCrownStorage.checkpointStorage();
		uint32 nCheckpoints = cs.numCheckpoints[account];
		if (nCheckpoints == 0) {
			return 0;
		}

		// First check most recent balance
		if (cs.checkpoints[account][nCheckpoints - 1].fromBlock <= blockNumber) {
			return cs.checkpoints[account][nCheckpoints - 1].votes;
		}

		// Next check implicit zero balance
		if (cs.checkpoints[account][0].fromBlock > blockNumber) {
			return 0;
		}

		uint32 lower = 0;
		uint32 upper = nCheckpoints - 1;
		while (upper > lower) {
			uint32 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
			Checkpoint memory cp = cs.checkpoints[account][center];
			if (cp.fromBlock == blockNumber) {
				return cp.votes;
			} else if (cp.fromBlock < blockNumber) {
				lower = center;
			} else {
				upper = center - 1;
			}
		}
		return cs.checkpoints[account][lower].votes;
	}

	/**
	 * @notice Internal implementation of stake
	 * @param voter The user that is staking tokens
	 * @param token The token to stake
	 * @param tokenAmount The amount of token to stake
	 * @param votingPower The amount of voting power stake translates into
	 */
	function _stake(
		address voter,
		address token,
		uint256 tokenAmount,
		uint256 votingPower
	) internal {
		IERC20(token).safeTransferFrom(voter, address(this), tokenAmount);

		StakeStorage storage ss = LibCrownStorage.stakeStorage();
		ss.stakes[voter][token].amount = ss.stakes[voter][token].amount.add(tokenAmount);
		ss.stakes[voter][token].votingPower = ss.stakes[voter][token].votingPower.add(votingPower);

		emit Staked(voter, token, tokenAmount, votingPower);

		_increaseVotingPower(voter, votingPower);
	}

	/**
	 * @notice Internal implementation of withdraw
	 * @param voter The user with tokens staked
	 * @param token The token that is staked
	 * @param tokenAmount The amount of token to withdraw
	 * @param votingPower The amount of voting power stake translates into
	 */
	function _withdraw(
		address voter,
		address token,
		uint256 tokenAmount,
		uint256 votingPower
	) internal {
		StakeStorage storage ss = LibCrownStorage.stakeStorage();
		require(ss.stakes[voter][token].amount >= tokenAmount, "VP::_withdraw: not enough tokens staked");
		require(ss.stakes[voter][token].votingPower >= votingPower, "VP::_withdraw: not enough voting power");
		ss.stakes[voter][token].amount = ss.stakes[voter][token].amount.sub(tokenAmount);
		ss.stakes[voter][token].votingPower = ss.stakes[voter][token].votingPower.sub(votingPower);

		IERC20(token).safeTransfer(voter, tokenAmount);

		emit Withdrawn(voter, token, tokenAmount, votingPower);

		_decreaseVotingPower(voter, votingPower);
	}

	/**
	 * @notice Increase voting power of voter
	 * @param voter The voter whose voting power is increasing
	 * @param amount The amount of voting power to increase by
	 */
	function _increaseVotingPower(address voter, uint256 amount) internal {
		CheckpointStorage storage cs = LibCrownStorage.checkpointStorage();
		uint32 checkpointNum = cs.numCheckpoints[voter];
		uint256 votingPowerOld = checkpointNum > 0 ? cs.checkpoints[voter][checkpointNum - 1].votes : 0;
		uint256 votingPowerNew = votingPowerOld.add(amount);
		_writeCheckpoint(voter, checkpointNum, votingPowerOld, votingPowerNew);
	}

	/**
	 * @notice Decrease voting power of voter
	 * @param voter The voter whose voting power is decreasing
	 * @param amount The amount of voting power to decrease by
	 */
	function _decreaseVotingPower(address voter, uint256 amount) internal {
		CheckpointStorage storage cs = LibCrownStorage.checkpointStorage();
		uint32 checkpointNum = cs.numCheckpoints[voter];
		uint256 votingPowerOld = checkpointNum > 0 ? cs.checkpoints[voter][checkpointNum - 1].votes : 0;
		uint256 votingPowerNew = votingPowerOld.sub(amount);
		_writeCheckpoint(voter, checkpointNum, votingPowerOld, votingPowerNew);
	}

	/**
	 * @notice Create checkpoint of voting power for voter at current block number
	 * @param voter The voter whose voting power is changing
	 * @param nCheckpoints The current checkpoint number for voter
	 * @param oldVotes The previous voting power of this voter
	 * @param newVotes The new voting power of this voter
	 */
	function _writeCheckpoint(
		address voter,
		uint32 nCheckpoints,
		uint256 oldVotes,
		uint256 newVotes
	) internal {
		uint32 blockNumber = _safe32(block.number, "VP::_writeCheckpoint: block number exceeds 32 bits");

		CheckpointStorage storage cs = LibCrownStorage.checkpointStorage();
		if (nCheckpoints > 0 && cs.checkpoints[voter][nCheckpoints - 1].fromBlock == blockNumber) {
			cs.checkpoints[voter][nCheckpoints - 1].votes = newVotes;
		} else {
			cs.checkpoints[voter][nCheckpoints] = Checkpoint(blockNumber, newVotes);
			cs.numCheckpoints[voter] = nCheckpoints + 1;
		}

		emit VotingPowerChanged(voter, oldVotes, newVotes);
	}

	/**
	 * @notice Converts uint256 to uint32 safely
	 * @param n Number
	 * @param errorMessage Error message to use if number cannot be converted
	 * @return uint32 number
	 */
	function _safe32(uint256 n, string memory errorMessage) internal pure returns (uint32) {
		require(n < 2**32, errorMessage);
		return uint32(n);
	}
}
