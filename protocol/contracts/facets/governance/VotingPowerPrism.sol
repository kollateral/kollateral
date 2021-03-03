/*

	Copyright (c) [2020] [Archer DAO]
    Copyright 2020-2021 ARM Finance LLC

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by crownlicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/
// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.2;

import "hardhat/console.sol";

import "../../libraries/governance/PrismProxy.sol";

/**
 * @title VotingPowerPrism
 * @dev Storage for voting power is at this address, while contract calls are delegated to the PrismProxy implementation
 * @dev All contracts that use voting power should reference this contract
 */
contract VotingPowerPrism is PrismProxy {
	/**
	 * @notice Construct a new Voting Power Prism Proxy
	 * @dev Sets initial proxy admin to `_admin`
	 * @param _admin Initial proxy admin
	 */
	constructor(address _admin) {
		// Initialize storage
		ProxyStorage storage s = proxyStorage();
		// Set initial proxy admin
		s.admin = _admin;
	}

	/**
	 * @notice Forwards call to implementation contract
	 */
	receive() external payable {
		_forwardToImplementation();
	}

	/**
	 * @notice Forwards call to implementation contract
	 */
	fallback() external payable {
		_forwardToImplementation();
	}
}
