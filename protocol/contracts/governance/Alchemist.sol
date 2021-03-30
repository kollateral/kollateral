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


                ██████████
            ████▓▓▓▓▓▓▓▓▓▓████
        ████▓▓▓▓▒▒▓▓  ▒▒▓▓▓▓▓▓████
      ██▓▓▓▓▒▒  ▒▒▒▒▒▒  ▒▒  ▓▓▓▓▓▓██
      ██▓▓▓▓  ▒▒░░░░░░  ░░▒▒▒▒  ▓▓██
    ██▓▓  ▒▒░░    ░░░░░░  ░░  ▒▒▒▒▓▓██
    ██▓▓▓▓  ░░  ░░▓▓▓▓▒▒░░  ░░    ▓▓██
  ██▓▓▒▒▒▒░░  ░░▓▓▒▒▒▒▒▒▓▓░░  ░░▒▒▓▓▓▓██
  ██▓▓▒▒    ░░▓▓▒▒░░░░░░▒▒▓▓░░░░    ▓▓██
  ██▓▓  ▒▒░░░░▓▓▒▒░░  ░░▒▒▓▓░░  ▒▒▓▓▓▓██
  ██▓▓▓▓▒▒░░░░▓▓▒▒░░░░░░▒▒▓▓░░░░▒▒  ▓▓██
  ██▒▒▒▒▒▒░░  ░░▓▓▒▒▒▒▒▒▓▓░░      ▒▒▓▓██
    ▓▓▓▓▒▒  ░░  ░░▓▓▓▓▓▓░░  ░░▒▒▒▒▓▓▓▓
    ██▓▓  ▒▒░░░░  ░░░░░░    ░░▒▒  ▓▓██
      ██▓▓▒▒▒▒  ░░░░░░  ░░▒▒    ▓▓██
      ██▓▓▓▓▓▓  ▒▒▒▒▒▒  ▒▒▓▓▓▓▓▓▓▓██
        ████▓▓▓▓  ▒▒  ▒▒▒▒▓▓▓▓████
          ░░████▓▓▓▓▓▓▓▓▓▓████░░
          ░░░░░░▓▓▓▓▓▓▓▓▓▓░░░░░░
            ░░░░▒▒▒▒░░░░▒▒░░░░
            ░░░░  ░░      ░░░░
          ░░░░▒▒░░░░░░░░░░░░░░░░
        ▒▒░░░░  ░░    ░░░░  ░░░░░░
            ░░░░░░░░░░░░░░░░░░

*/
// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.2;

import "hardhat/console.sol";

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

import "../libraries/governance/AlchemicalBondingCurve.sol";
import "../libraries/math/RoyalMath.sol";

import "../interfaces/IWETH10.sol";

/**
 * @title Alchemist
 * @notice Distributes the reserve token in exchange for bootstrapping liquidity in the PLLPs.
 * @dev Users cannot send ether directly to the contract to participate. Also see RoyalMines.sol
 */
contract Alchemist is AlchemicalBondingCurve {
	using SafeERC20 for IERC20;

	event Transmuted(address indexed user, uint256 etherAmount, uint256 reserveAmount);
	event Distilled(address indexed pool, uint256 amount);
	event ReservesDeposited(uint256 indexed transmutableReserve, uint256 indexed liquidityReserve);
	event ReserveWithdrawn(uint256 indexed amount);

	/// @notice Event emitted when the owner of the contract is updated
	event ChangedTreasury(address indexed oldTreasury, address indexed pendingTreasury);
	event AcceptedTreasury(address indexed newTreasury);

	/// @notice The reserve token for the IBCO
	IERC20 public immutable reserveToken;

	/// @notice Configuration vars for the IBCO
	uint256 public end;
	uint256 public immutable minimumIngredient; // should be 0.9 ether;
	uint256 public maximumGasPrice = 369 gwei;  // 1 gwei == 1e9

	/// @notice counters for keeping track of total contributions and transmutations, used in `distillate`
	uint256 public transmutableReserve; // should be 4500_e18;
	uint256 public liquidityReserve; // should be 2700_e18;
	uint256 public totalEtherProvided = 0;
	uint256 public totalReserveTransmuted = 0;
	bool public distilled;

	/// @notice Current treasury of this contract
	address public treasury;
	address public pendingTreasury;

	/// @notice only treasury can call function
	modifier onlyTreasury {
		require(msg.sender == treasury, "Alchemist::onlyTreasury: not treasury");
		_;
	}

	/// @notice only "low" gas tx are allowed
	modifier onlyLowGas() {
		require(tx.gasprice <= maximumGasPrice, "Alchemist::onlyLowGas: gas price too high");
		_;
	}

	/**
	 * @notice Construct a new IBCO
	 * @param _reserveToken The reserve token to be transmuted
	 * @param _minimumIngredient The minimum contribution required per transmutation
	 */
	constructor(IERC20 _reserveToken, uint256 _minimumIngredient) public {
		reserveToken = _reserveToken;
		minimumIngredient = _minimumIngredient;
		treasury = msg.sender;
	}

	/**
	 * @notice Safely transfers reserve token liquidity from msg.sender to this contract
	 * @dev requires pre-approval for initial liquidity amount
	 * @param _transmutableReserve The amount of reserve token to be transmuted
	 * @param _liquidityReserve The amount of reserve token to be locked into the Mines (along with Ether proceedings)
	 */
	function depositReserve(uint256 _transmutableReserve, uint256 _liquidityReserve) external onlyTreasury {
		require(transmutableReserve == 0, "Alchemist::transmute: reserve was already deposited");

		reserveToken.safeTransferFrom(treasury, address(this), _transmutableReserve);
		transmutableReserve = _transmutableReserve; // secure the transmutable reserve, offered once for sale
		reserveToken.safeTransferFrom(treasury, address(this), _liquidityReserve);
		liquidityReserve = _liquidityReserve; // secure the liquidity reserve, sent to the Mines (PLLP) for distillation
		end = block.timestamp + 9 days;

		emit ReservesDeposited(transmutableReserve, liquidityReserve);
	}

	function transmute() external payable onlyLowGas {
		require(block.timestamp <= end, "Alchemist::transmute: the offering has ended");
		require(msg.value >= minimumIngredient, "Alchemist::transmute: more ETH ingredient needed");
		require(transmutableReserve > 0, "Alchemist::transmute: not enough reserve was deposited");

		uint256 etherProvided = msg.value;
		uint256 totalReserveBefore = reserveToken.balanceOf(address(this));
		uint256 payableReserveAmount = 0;

		payableReserveAmount = flatPayable(transmutableReserve, etherProvided, totalEtherProvided == 0 ? 900 : 9000);

		if (totalReserveBefore < payableReserveAmount) {
			revert("Alchemist::transmute: Not enough transmutable reserve left");
		} else {
			reserveToken.safeTransfer(msg.sender, payableReserveAmount);
		}

		totalReserveTransmuted += payableReserveAmount;
		totalEtherProvided += etherProvided;

		emit Transmuted(msg.sender, etherProvided, payableReserveAmount);
	}

	function distillate() external onlyTreasury {
		require(end < block.timestamp, "Alchemist::distillate: distillation unavailable yet");
		require(!distilled, "Alchemist::distillate: can only distillate once!");

		IWETH10 wETH10 = IWETH10(0xf4BB2e28688e89fCcE3c0580D37d36A7672E8A9F);
		// convert all ether proceedings into WETH10
		wETH10.deposit{ value: totalEtherProvided - unit(18) }();
		uint256 wETH = wETH10.balanceOf(address(this));

		// TODO: Evaluate UNI_V3
		// TODO: lock into the Mines right away instead?
		IUniswapV2Router02 UNI_V2_Router = IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
		// approve
		wETH10.approve(address(UNI_V2_Router), wETH);
		reserveToken.approve(address(UNI_V2_Router), liquidityReserve);

		// create UNI_V2 LP
		(uint256 tokenA, uint256 tokenB, uint256 liq) =
			UNI_V2_Router.addLiquidity(
				address(wETH10),
				address(reserveToken),
				wETH,
				liquidityReserve,
				wETH,
				liquidityReserve,
				msg.sender,
				block.timestamp + 1 days
			);
		assert(tokenA == wETH);
		assert(tokenB == liquidityReserve);

		// Unclaimed IBCO KING reserve should now be claimed by Treasury, with `withdrawReserve`
		distilled = true;
	}

	function withdrawReserve() external onlyTreasury {
		require(end + 9 hours < block.timestamp, "Alchemist::withdrawReserve: withdrawal unavailable yet");
		require(distilled, "Alchemist::withdrawReserve: distillation must be completed first");

		uint256 reserve = reserveToken.balanceOf(address(this));
		reserveToken.safeTransfer(treasury, reserve);

		emit ReserveWithdrawn(reserve);
	}

	function changeTreasury(address _treasury) external onlyTreasury {
		require(
			_treasury != address(0) && _treasury != address(this) && treasury != _treasury,
			"Alchemist::changeTreasury: treasury address is invalid"
		);

		address oldTreasury = treasury;
		pendingTreasury = _treasury;

		emit ChangedTreasury(oldTreasury, pendingTreasury);
	}

	function acceptTreasury() external {
		require(msg.sender == pendingTreasury, "Alchemist::acceptTreasury: pending treasury address is invalid");

		treasury = pendingTreasury;
		pendingTreasury = address(0);

		emit AcceptedTreasury(treasury);
	}

	function changeGasPrice(uint256 _maximumGasPrice) public onlyTreasury {
		maximumGasPrice = _maximumGasPrice;
	}
}
