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

import "../token/ERC20/IERC20.sol";

interface ICrownGovernanceToken is IERC20 {
	/// @notice An event that's emitted when the mintCap is changed
	event MintCapChanged(uint32 indexed oldMintCap, uint32 indexed newMintCap);
	/// @notice An event that's emitted when the supplyManager address is changed
	event SupplyManagerChanged(address indexed oldManager, address indexed newManager);
	/// @notice An event that's emitted when the supplyChangeWaitingPeriod is changed
	event SupplyChangeWaitingPeriodChanged(uint32 indexed oldWaitingPeriod, uint32 indexed newWaitingPeriod);
	/// @notice An event that's emitted when the metadataManager address is changed
	event MetadataManagerChanged(address indexed oldManager, address indexed newManager);
	/// @notice An event that's emitted when the token name and symbol are changed
	event TokenMetaUpdated(string indexed name, string indexed symbol);
	/// @notice An event that's emitted whenever an authorized transfer occurs
	event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);

	function name() external view returns (string memory);

	function symbol() external view returns (string memory);

	function decimals() external view returns (uint8);

	function permit(
		address owner,
		address spender,
		uint256 value,
		uint256 deadline,
		uint8 v,
		bytes32 r,
		bytes32 s
	) external;

	function mint(address dst, uint256 amount) external returns (bool);

	function burn(address src, uint256 amount) external returns (bool);

	function updateTokenMetadata(string memory tokenName, string memory tokenSymbol) external returns (bool);

	function supplyManager() external view returns (address);

	function metadataManager() external view returns (address);

	function supplyChangeAllowedAfter() external view returns (uint256);

	function supplyChangeWaitingPeriod() external view returns (uint32);

	function supplyChangeWaitingPeriodMinimum() external view returns (uint32);

	function mintCap() external view returns (uint32);

	function setSupplyManager(address newSupplyManager) external returns (bool);

	function setMetadataManager(address newMetadataManager) external returns (bool);

	function setSupplyChangeWaitingPeriod(uint32 period) external returns (bool);

	function setMintCap(uint32 newCap) external returns (bool);
}
