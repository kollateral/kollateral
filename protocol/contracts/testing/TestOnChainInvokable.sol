/*

    Copyright 2020 Kollateral LLC
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

import "../libraries/access/Ownable.sol";
import "../common/invoke/KingmakerInvokable.sol";

/*
 *  NOTICE: ONLY FOR ON-CHAIN TESTING - THIS CONTRACT IS VULNERABLE TO LOSS OF FUNDS
 */
contract TestOnChainInvokable is KingmakerInvokable, Ownable {
	constructor() {}

	event HelperDump(
		address sender,
		bytes32 dataHash,
		address currentTokenAddress,
		uint256 currentTokenAmount,
		uint256 currentRepaymentAmount,
		bool isCurrentTokenEther
	);

	function execute(bytes calldata data) external payable override {
		emitHelper(data);
		repay();
	}

	function emitHelper(bytes memory data) internal {
		emit HelperDump(
			currentSender(),
			keccak256(data),
			currentTokenAddress(),
			currentTokenAmount(),
			currentRepaymentAmount(),
			isCurrentTokenEther()
		);
	}

	function withdraw(address tokenAddress, uint256 amount) external onlyOwner returns (bool) {
		return transfer(tokenAddress, msg.sender, amount);
	}

	fallback() external {}
}
