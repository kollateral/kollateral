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
pragma solidity ^0.8.2;

import "./IInvokable.sol";
import "./IInvocationHook.sol";
import "../utils/BalanceCarrier.sol";

abstract contract KingmakerInvokable is BalanceCarrier, IInvokable {
	uint256 internal MAX_REWARD_BIPS = 100;

	constructor() BalanceCarrier(address(1)) {}

	function repay() internal repaymentSafeguard {
		require(
			transfer(currentTokenAddress(), msg.sender, currentRepaymentAmount()),
			"KingmakerInvokable: failed to repay"
		);
	}

	function currentSender() internal view returns (address) {
		return IInvocationHook(msg.sender).currentSender();
	}

	function currentTokenAddress() internal view returns (address) {
		return IInvocationHook(msg.sender).currentTokenAddress();
	}

	function currentTokenAmount() internal view returns (uint256) {
		return IInvocationHook(msg.sender).currentTokenAmount();
	}

	function currentRepaymentAmount() internal view returns (uint256) {
		return IInvocationHook(msg.sender).currentRepaymentAmount();
	}

	function isCurrentTokenEther() internal view returns (bool) {
		return currentTokenAddress() == address(1);
	}

	modifier repaymentSafeguard() {
		uint256 effectiveReward = ((currentRepaymentAmount() - currentTokenAmount()) * 10000) / currentTokenAmount();

		require(effectiveReward <= MAX_REWARD_BIPS, "KingmakerInvokable: repayment reward too high");
		_;
	}
}
