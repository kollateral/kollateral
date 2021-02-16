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
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.1;

/******************************************************************************\
* Author: Nick Mudge <nick@perfectabstractions.com> (https://twitter.com/mudgen)
* EIP-2535 Diamond Standard: https://eips.ethereum.org/EIPS/eip-2535
/******************************************************************************/

/**
 * A loupe is a small magnifying glass used to look at diamonds.
 */
interface IDiamondLoupe {
	/// These functions are expected to be called frequently by off-chain code.
	/// (and almost never by on-chain code)
	struct Facet {
		address facetAddress;
		bytes4[] functionSelectors;
	}

	/// @notice Gets all facet addresses and their four byte function selectors.
	/// @return facets_ Facet
	function facets() external view returns (Facet[] memory facets_);

	/// @notice Gets all the function selectors supported by a specific facet.
	/// @param _facet The facet address.
	/// @return facetFunctionSelectors_
	function facetFunctionSelectors(address _facet) external view returns (bytes4[] memory facetFunctionSelectors_);

	/// @notice Get all the facet addresses used by a diamond.
	/// @return facetAddresses_
	function facetAddresses() external view returns (address[] memory facetAddresses_);

	/// @notice Gets the facet that supports the given selector.
	/// @dev If facet is not found return address(0).
	/// @param _functionSelector The function selector.
	/// @return facetAddress_ The facet address.
	function facetAddress(bytes4 _functionSelector) external view returns (address facetAddress_);
}
