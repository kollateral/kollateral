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

*/
// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.2;

import "../libraries/token/ERC20/ERC20.sol";

contract ERC20Mock is ERC20("ERC20Mock", "MOCK") {
	bool public transferFromCalled = false;

	bool public transferCalled = false;
	address public transferRecipient = address(0);
	uint256 public transferAmount = 0;

	function mint(address user, uint256 amount) public {
		_mint(user, amount);
	}

	function burnFrom(address user, uint256 amount) public {
		_burn(user, amount);
	}

	function transferFrom(
		address sender,
		address recipient,
		uint256 amount
	) public virtual override returns (bool) {
		transferFromCalled = true;

		return super.transferFrom(sender, recipient, amount);
	}

	function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
		transferCalled = true;
		transferRecipient = recipient;
		transferAmount = amount;

		return super.transfer(recipient, amount);
	}
}
