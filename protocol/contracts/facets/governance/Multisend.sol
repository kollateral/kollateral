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

import "hardhat/console.sol";

import "../../interfaces/governance/ICrownGovernanceToken.sol";

import "../../libraries/security/ReentrancyGuard.sol";

/**
 * @title Multisend
 * @dev Allows the sender to perform batch transfers of KING tokens
 */
contract Multisend is ReentrancyGuard {
	/// @notice Kingmaker governance token
	ICrownGovernanceToken public token;

	/**
	 * @notice Construct a new Multisend contract
	 * @param _token Address of KING token
	 */
	constructor(ICrownGovernanceToken _token) {
		token = _token;
	}

	/**
	 * @notice Batches multiple transfers
	 * @dev Must approve this contract for `totalAmount` before calling
	 * @param totalAmount Total amount to be transferred
	 * @param recipients Array of accounts to receive transfers
	 * @param amounts Array of amounts to send to accounts via transfers
	 */
	function batchTransfer(
		uint256 totalAmount,
		address[] calldata recipients,
		uint256[] calldata amounts
	) external nonReentrant {
		_batchTransfer(totalAmount, recipients, amounts);
	}

	/**
	 * @notice Batches multiple transfers with approval provided by permit function
	 * @param totalAmount Total amount to be transferred
	 * @param recipients Array of accounts to receive transfers
	 * @param amounts Array of amounts to send to accounts via transfers
	 * @param deadline The time at which to expire the signature
	 * @param v The recovery byte of the signature
	 * @param r Half of the ECDSA signature pair
	 * @param s Half of the ECDSA signature pair
	 */
	function batchTransferWithPermit(
		uint256 totalAmount,
		address[] calldata recipients,
		uint256[] calldata amounts,
		uint256 deadline,
		uint8 v,
		bytes32 r,
		bytes32 s
	) external nonReentrant {
		token.permit(msg.sender, address(this), totalAmount, deadline, v, r, s);
		_batchTransfer(totalAmount, recipients, amounts);
	}

	/**
	 * @notice Internal implementation of batch transfer
	 * @param totalAmount Total amount to be transferred
	 * @param recipients Array of accounts to receive transfers
	 * @param amounts Array of amounts to send to accounts via transfers
	 */
	function _batchTransfer(
		uint256 totalAmount,
		address[] calldata recipients,
		uint256[] calldata amounts
	) internal {
		require(
			token.allowance(msg.sender, address(this)) >= totalAmount,
			"Multisend::_batchTransfer: allowance too low"
		);
		require(token.balanceOf(msg.sender) >= totalAmount, "Multisend::_batchTransfer: sender balance too low");
		require(recipients.length == amounts.length, "Multisend::_batchTransfer: recipients length != amounts length");
		uint256 amountTransferred = 0;
		for (uint256 i; i < recipients.length; i++) {
			bool success = token.transferFrom(msg.sender, recipients[i], amounts[i]);
			require(success, "Multisend::_batchTransfer: failed to transfer tokens");
			amountTransferred = amountTransferred + amounts[i];
		}
		require(amountTransferred == totalAmount, "Multisend::_batchTransfer: total != transferred amount");
	}
}
