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

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

abstract contract UnlimitedApprovalERC20 is ERC20 {
	function transferFrom(
		address sender,
		address recipient,
		uint256 amount
	) public override returns (bool) {
		_transfer(sender, recipient, amount);
		// Check for and update remaining allowance
		if (allowance(sender, _msgSender()) != type(uint256).max) {
			_approve(
				sender,
				_msgSender(),
				SafeMath.sub(
					allowance(sender, _msgSender()),
					amount,
					"UnlimitedApprovalERC20: transfer amount exceeds allowance"
				)
			);
		}

		return true;
	}
}
