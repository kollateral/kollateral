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
pragma solidity ^0.8.1;

import "@openzeppelin/contracts/utils/Initializable.sol";

import "./PrismProxy.sol";

contract PrismProxyImplementation is Initializable {
	/**
	 * @notice Accept invitation to be implementation contract for proxy
	 * @param prism Prism Proxy contract
	 */
	function become(PrismProxy prism) public {
		require(msg.sender == prism.proxyAdmin(), "Prism::become: only proxy admin can change implementation");
		require(prism.acceptProxyImplementation() == true, "Prism::become: change not authorized");
	}
}
