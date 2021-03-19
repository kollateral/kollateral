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

import "../libraries/governance/LinearBondingCurve.sol";
import "../libraries/math/RoyalMath.sol";

/**
 * @title Alchemist
 * @notice Distributes the reserve token in exchange for bootstrapping liquidity in the PLLPs.
 * @dev Users cannot send ether directly to the contract to participate. Also see Mines.sol
 */
contract Alchemist is LinearBondingCurve {
	using SafeERC20 for IERC20;

	event Transmuted(address indexed user, uint256 etherAmount, uint256 reserveAmount);
	event Distilled(address indexed pool, uint256 amount);
	event ReserveDeposited(uint256 indexed start, uint256 indexed amount);
	event ReserveWithdrawn(uint256 indexed amount);

	/// @notice Event emitted when the owner of the contract is updated
	event ApostolicSuccession(address indexed oldClergy, address indexed newClergy);

	/// @notice The reserve token for the IBCO
	IERC20 public immutable reserveToken;

	/// @notice Configuration vars for the IBCO
	uint256 public start;
	uint256 public immutable end;
	uint256 public immutable minimumIngredient; // should be 0.9 ether;
	bool public immutable competitive;

	/// @notice counters for keeping track of total offerings and transmutations, used in distillation
	uint256 public transmutableReserve; // should be 9000_e18;
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
	constructor(
		IERC20 _reserveToken,
		uint256 _minimumIngredient,
		bool _competitive // TODO: BC should become non-competitive
	) public {
		end = block.timestamp + 9 days;

		reserveToken = _reserveToken;
		minimumIngredient = _minimumIngredient;
		competitive = _competitive;

		clergy = msg.sender;
	}

	/**
	 * @notice Safely transfers reserve token liquidity from msg.sender to this contract
	 * @dev requires pre-approval for initial liquidity amount
	 * @param _transmutableReserve The amount of reserve token to be transmuted
		TODO: Add _liquidityReserve to 'depositReserve(s)'
	 */
	function depositReserve(uint256 _transmutableReserve) external onlyChurch {
		require(end >= block.timestamp, "Alchemist::depositReserve: Deposit unavailable at the end");
		require(transmutableReserve == 0, "Alchemist::transmute: Reserve was already deposited");

		reserveToken.safeTransferFrom(clergy, address(this), _transmutableReserve);
		transmutableReserve = _transmutableReserve / 2; // retain half reserve for the Mines (after the IBCO has ended)
		start = block.timestamp;

		emit ReserveDeposited(start, transmutableReserve);
	}

	function transmute() external payable {
		require(transmutableReserve > 0, "Alchemist::transmute: No reserve was deposited");
		require(block.timestamp <= end, "Alchemist::transmute: The offering has ended");
		require(msg.value >= minimumIngredient, "Alchemist::transmute: more ETH ingredient");

		uint256 etherProvided = msg.value;
		totalEtherProvided += etherProvided;

		uint256 payableReserveAmount = 0;
		uint256 reserveBefore = reserveToken.balanceOf(address(this));

		console.log("reserveBefore:");
		console.logUint(reserveBefore);

		if (competitive) {
			uint256 totalReserveSupply = reserveToken.totalSupply();
			// Linear distribution
			payableReserveAmount = calculatePurchaseReturn(
				totalReserveSupply,
				totalEtherProvided,
				totalReserveTransmuted,
				etherProvided
			);
		} else {
			// Flat distribution
			payableReserveAmount = transmutableReserve * etherProvided / totalEtherProvided;
		}
		console.log("payableReserveAmount:");
		console.logUint(payableReserveAmount);

		reserveToken.safeTransfer(msg.sender, payableReserveAmount);
		totalReserveTransmuted += payableReserveAmount;

		uint256 reserveAfter = reserveToken.balanceOf(address(this));
		console.log("reserveAfter:");
		console.logUint(reserveAfter);

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
