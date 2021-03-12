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

interface ITokenRegistry {
	/// @notice Event emitted when a new token is supported
	event TokenFormulaAdded(address indexed token, address indexed formula);
	/// @notice Event emitted when a token formula is updated
	event TokenFormulaUpdated(address indexed token, address indexed formula);
	/// @notice Event emitted when a supported token is removed
	event TokenFormulaRemoved(address indexed token);

	function tokenFormula(address) external view returns (address);

	function setTokenFormula(address token, address formula) external;

	function removeToken(address token) external;

	function changeOwner(address newOwner) external;
}
