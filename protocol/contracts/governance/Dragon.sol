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

                                                    ___
                                                  .~))>>
                                                 .~)>>
                                               .~))))>>>
                                             .~))>>             ___
                                           .~))>>)))>>      .-~))>>
                                         .~)))))>>       .-~))>>)>
                                       .~)))>>))))>>  .-~)>>)>
                   )                 .~))>>))))>>  .-~)))))>>)>
                ( )@@*)             //)>))))))  .-~))))>>)>
              ).@(@@               //))>>))) .-~))>>)))))>>)>
            (( @.@).              //))))) .-~)>>)))))>>)>
          ))  )@@*.@@ )          //)>))) //))))))>>))))>>)>
       ((  ((@@@.@@             |/))))) //)))))>>)))>>)>
      )) @@*. )@@ )   (\_(\-\b  |))>)) //)))>>)))))))>>)>
    (( @@@(.@(@ .    _/`-`  ~|b |>))) //)>>)))))))>>)>
     )* @@@ )@*     (@) (@)  /\b|))) //))))))>>))))>>
   (( @. )@( @ .   _/       /  \b)) //))>>)))))>>>_._
    )@@ (@@*)@@.  (6,   6) / ^  \b)//))))))>>)))>>   ~~-.
 ( @jgs@@. @@@.*@_ ~^~^~, /\  ^  \b/)>>))))>>      _.     `,
  ((@@ @@@*.(@@ .   \^^^/' (  ^   \b)))>>        .'         `,
   ((@@).*@@ )@ )    `-'   ((   ^  ~)_          /             `,
     (@@. (@@ ).           (((   ^    `\        |               `.
       (*.@*              / ((((        \        \      .         `.
                         /   (((((  \    \    _.-~\     Y,         ;
                        /   / (((((( \    \.-~   _.`" _.-~`,       ;
                       /   /   `(((((()    )    (((((~      `,     ;
                     _/  _/      `"""/   /'                  ;     ;
                 _.-~_.-~           /  /'                _.-~   _.'
               ((((~~              / /'              _.-~ __.--~
                                  ((((          __.-~ _.-~
                                              .'   .~~
                                              :    ,'
                                              ~~~~~

*/
// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.2;

import "hardhat/console.sol";

import "../interfaces/governance/ILockManager.sol";
import "../interfaces/governance/IMasterChef.sol";
import "../interfaces/governance/IVault.sol";

import "../libraries/governance/LibCrownStorage.sol";
import "../libraries/governance/Treasurer.sol";

/**
 * @title Dragon (prev. RewardsManager)
 * @dev Oversees rewards distribution withing the Kingmaker ecosystem
 */
contract Dragon is Treasurer {
	using SafeERC20 for IERC20;

	/**
	 * @notice Create a new Rewards Manager contract
	 * @param _master master of contract
	 * @param _lockManager address of LockManager contract
	 * @param _vault address of Vault contract
	 * @param _rewardToken address of token that is being offered as a reward
	 * @param _sushiToken address of SUSHI token
	 * @param _masterChef address of SushiSwap MasterChef contract
	 * @param _startBlock block number when rewards will start
	 * @param _rewardTokensPerBlock *initial* amount of reward tokens to be distributed per block
	 */
	constructor(
		address _master,
		address _lockManager,
		address _vault,
		address _rewardToken,
		address _sushiToken,
		address _masterChef,
		uint256 _startBlock,
		uint256 _rewardTokensPerBlock
	) {
		master = _master;
		emit ChangedMaster(address(0), _master);

		lockManager = ILockManager(_lockManager);
		emit ChangedAddress("LOCK_MANAGER", address(0), _lockManager);

		vault = IVault(_vault);
		emit ChangedAddress("VAULT", address(0), _vault);

		rewardToken = IERC20(_rewardToken);
		emit ChangedAddress("REWARD_TOKEN", address(0), _rewardToken);

		sushiToken = IERC20(_sushiToken);
		emit ChangedAddress("SUSHI_TOKEN", address(0), _sushiToken);

		masterChef = IMasterChef(_masterChef);
		emit ChangedAddress("MASTER_CHEF", address(0), _masterChef);

		startBlock = _startBlock == 0 ? block.number : _startBlock;
		emit SetRewardsStartBlock(startBlock);

		rewardTokensPerBlock = _rewardTokensPerBlock;
		emit ChangedRewardTokensPerBlock(0, _rewardTokensPerBlock);

		rewardToken.safeIncreaseAllowance(address(vault), type(uint256).max);
	}

	/**
	 * @notice Set new rewards per block
	 * @dev Can only be called by the master
	 * @param newRewardTokensPerBlock new amount of reward token to reward each block
	 */
	function setRewardsPerBlock(uint256 newRewardTokensPerBlock) external onlyMaster {
		emit ChangedRewardTokensPerBlock(rewardTokensPerBlock, newRewardTokensPerBlock);
		rewardTokensPerBlock = newRewardTokensPerBlock;
		_setRewardsEndBlock();
	}

	/**
	 * @notice Set new reward token address
	 * @param newToken address of new reward token
	 * @param newRewardTokensPerBlock new amount of reward token to reward each block
	 */
	function setRewardToken(address newToken, uint256 newRewardTokensPerBlock) external onlyMaster {
		emit ChangedAddress("REWARD_TOKEN", address(rewardToken), newToken);
		rewardToken = IERC20(newToken);
		rewardTokensPerBlock = newRewardTokensPerBlock;
		_setRewardsEndBlock();
	}

	/**
	 * @notice Set new SUSHI token address
	 * @dev Can only be called by the master
	 * @param newToken address of new SUSHI token
	 */
	function setSushiToken(address newToken) external onlyMaster {
		emit ChangedAddress("SUSHI_TOKEN", address(sushiToken), newToken);
		sushiToken = IERC20(newToken);
	}

	/**
	 * @notice Set new MasterChef address
	 * @dev Can only be called by the master
	 * @param newAddress address of new MasterChef
	 */
	function setMasterChef(address newAddress) external onlyMaster {
		emit ChangedAddress("MASTER_CHEF", address(masterChef), newAddress);
		masterChef = IMasterChef(newAddress);
	}

	/**
	 * @notice Set new Vault address
	 * @param newAddress address of new Vault
	 */
	function setVault(address newAddress) external onlyMaster {
		emit ChangedAddress("VAULT", address(vault), newAddress);
		vault = IVault(newAddress);
	}

	/**
	 * @notice Set new LockManager address
	 * @param newAddress address of new LockManager
	 */
	function setLockManager(address newAddress) external onlyMaster {
		emit ChangedAddress("LOCK_MANAGER", address(lockManager), newAddress);
		lockManager = ILockManager(newAddress);
	}

	/**
	 * @notice Change master of vesting contract
	 * @dev Can only be called by the master
	 * @param newOwner New master address
	 */
	function changeMaster(address newOwner) external onlyMaster {
		require(newOwner != address(0) && newOwner != address(this), "Dragon::changeMaster: not valid address");
		emit ChangedMaster(master, newOwner);
		master = newOwner;
	}
}
