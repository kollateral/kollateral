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

import "./CollateralizedToken.sol";

import "../common/utils/ExternalCaller.sol";

abstract contract CollateralizedEther is CollateralizedToken, ExternalCaller {
	using SafeMath for uint256;

	constructor() CollateralizedToken(address(1)) {}

	function mint() external payable returns (bool) {
		return mintInternal(msg.value);
	}

	function transferUnderlying(address to, uint256 amount) internal override returns (bool) {
		require(address(this).balance >= amount, "CollateralizedEther: not enough ETH balance");
		externalTransfer(to, amount);
		return true;
	}

	function isUnderlyingEther() public pure override returns (bool) {
		return true;
	}

	function totalReserve() public view override returns (uint256) {
		return address(this).balance;
	}
}
