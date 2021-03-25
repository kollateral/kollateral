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

               *    .
        '  +   ___    @    .
            .-" __"-.   +
    *      /:.'`__`'.\       '
        . |:: .'_ `. :|   *
   @      |:: '._' : :| .
      +    \:'.__.' :/       '
            /`-...-'\  '   +
   '       /         \   .    @
     *     `-.,___,.-'
*/
// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.2;

import "hardhat/console.sol";

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../libraries/governance/AlchemicalBondingCurve.sol";
import "../libraries/math/RoyalMath.sol";

/**
 * @title Alchemist
 * @notice Distributes the reserve token in exchange for bootstrapping liquidity in the PLLPs.
 * @dev Users cannot send ether directly to the contract to participate. Also see Mines.sol
 */
contract Alchemist is AlchemicalBondingCurve {
	using SafeERC20 for IERC20;

	event Transmuted(address indexed user, uint256 etherAmount, uint256 reserveAmount);
	event Distilled(address indexed pool, uint256 amount);
	event ReservesDeposited(uint256 indexed transmutableReserve, uint256 indexed liquidityReserve);
	event ReserveWithdrawn(uint256 indexed amount);

	/// @notice Event emitted when the owner of the contract is updated
	event ApostolicSuccession(address indexed oldClergy, address indexed newClergy);

	/// @notice The reserve token for the IBCO
	IERC20 public immutable reserveToken;

	/// @notice Configuration vars for the IBCO
	uint256 public end;
	uint256 public immutable minimumIngredient; // should be 0.9 ether;

	/// @notice counters for keeping track of total offerings and transmutations, used in distillation
	uint256 public transmutableReserve; // should be 4500_e18;
	uint256 public liquidityReserve; // should be 2700_e18;
	uint256 public totalEtherProvided = 0;
	uint256 public totalReserveTransmuted = 0;
	bool public distilled;

	/// @notice Current clergy of this contract
	address public clergy;

	/// @notice only clergy can call function
	modifier onlyChurch {
		require(msg.sender == clergy, "Alchemist::onlyChurch: not clergy");
		_;
	}

	/**
	 * @notice Construct a new IBCO
	 * @param _reserveToken The reserve token to be transmuted
	 * @param _minimumIngredient The minimum offering allowed for transmutation to succeed
	 */
	constructor(IERC20 _reserveToken, uint256 _minimumIngredient) public {
		reserveToken = _reserveToken;
		minimumIngredient = _minimumIngredient;
		clergy = msg.sender;
	}

	/**
	 * @notice Safely transfers reserve token liquidity from msg.sender to this contract
	 * @dev requires pre-approval for initial liquidity amount
	 * @param _transmutableReserve The amount of reserve token to be transmuted
	 * @param _liquidityReserve The amount of reserve token to be locked into the Mines (along with Ether proceedings)
	 */
	function depositReserve(uint256 _transmutableReserve, uint256 _liquidityReserve) external onlyChurch {
		require(transmutableReserve == 0, "Alchemist::transmute: Reserve was already deposited");

		reserveToken.safeTransferFrom(clergy, address(this), _transmutableReserve);
		transmutableReserve = _transmutableReserve; // secure the transmutable reserve, offered once for sale
		reserveToken.safeTransferFrom(clergy, address(this), _liquidityReserve);
		liquidityReserve = _liquidityReserve; // secure the liquidity reserve, sent to the Mines (PLLP) for distillation
		end = block.timestamp + 9 days;

		emit ReservesDeposited(transmutableReserve, liquidityReserve);
	}

	function transmute() external payable {
		require(block.timestamp <= end, "Alchemist::transmute: The offering has ended");
		require(msg.value >= minimumIngredient, "Alchemist::transmute: more ETH ingredient needed");
		require(transmutableReserve > 0, "Alchemist::transmute: Not enough reserve was deposited");

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

	function distillate() external onlyChurch {
		require(end < block.timestamp, "Alchemist::distillate:The offering must be completed");

		// TODO: lock into the Mines (PLLP)

		distilled = true;
	}

	function withdrawReserve() external onlyChurch {
		require(end + 9 hours < block.timestamp, "Alchemist::withdrawReserve: Withdrawal unavailable yet");
		require(distilled, "Alchemist::withdrawReserve: distillation must be completed first");

		uint256 reserve = reserveToken.balanceOf(address(this));
		reserveToken.safeTransfer(clergy, reserve);

		emit ReserveWithdrawn(reserve);
	}

	/**
	 * @notice Change alchemist clergy
	 * @param newClergy New clergy address
	 */
	function conversion(address newClergy) external onlyChurch {
		require(
			newClergy != address(0) && newClergy != address(this) && newClergy != clergy,
			"Alchemist::conversion: not a valid clergy address"
		);

		address oldClergy = clergy;
		clergy = newClergy;

		emit ApostolicSuccession(oldClergy, newClergy);
	}
}
