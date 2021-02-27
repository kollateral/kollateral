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
* Contributors: [ lepidotteri, ]
* EIP-2535 Diamond Standard: https://eips.ethereum.org/EIPS/eip-2535
/******************************************************************************/

import "../libraries/diamond/LibDiamondStorage.sol";
import "../interfaces/diamond/IDiamondCut.sol";
import "../interfaces/diamond/IDiamondLoupe.sol";
import "../interfaces/introspection/IERC165.sol";

contract DiamondLoupeFacet is IDiamondLoupe, IERC165 {
	/// @notice Gets all facets and their selectors.
	/// @return facets_ Facet
	function facets() external view override returns (Facet[] memory facets_) {
		LibDiamondStorage.DiamondStorage storage ds = LibDiamondStorage.diamondStorage();
		uint256 numFacets = ds.facetAddresses.length;
		facets_ = new Facet[](numFacets);
		for (uint256 i; i < numFacets; i++) {
			address facetAddress_ = ds.facetAddresses[i];
			facets_[i].facetAddress = facetAddress_;
			facets_[i].functionSelectors = ds.facetFunctionSelectors[facetAddress_].functionSelectors;
		}
	}

	/// @notice Gets all the function selectors provided by a facet.
	/// @param _facet The facet address.
	/// @return facetFunctionSelectors_
	function facetFunctionSelectors(address _facet)
		external
		view
		override
		returns (bytes4[] memory facetFunctionSelectors_)
	{
		LibDiamondStorage.DiamondStorage storage ds = LibDiamondStorage.diamondStorage();
		facetFunctionSelectors_ = ds.facetFunctionSelectors[_facet].functionSelectors;
	}

	/// @notice Get all the facet addresses used by a diamond.
	/// @return facetAddresses_
	function facetAddresses() external view override returns (address[] memory facetAddresses_) {
		LibDiamondStorage.DiamondStorage storage ds = LibDiamondStorage.diamondStorage();
		facetAddresses_ = ds.facetAddresses;
	}

	/// @notice Gets the facet that supports the given selector.
	/// @dev If facet is not found return address(0).
	/// @param _functionSelector The function selector.
	/// @return facetAddress_ The facet address.
	function facetAddress(bytes4 _functionSelector) external view override returns (address facetAddress_) {
		LibDiamondStorage.DiamondStorage storage ds = LibDiamondStorage.diamondStorage();
		facetAddress_ = ds.selectorToFacetAndPosition[_functionSelector].facetAddress;
	}

	// This implements ERC-165.
	function supportsInterface(bytes4 _interfaceId) external view override returns (bool) {
		LibDiamondStorage.DiamondStorage storage ds = LibDiamondStorage.diamondStorage();
		return ds.supportedInterfaces[_interfaceId];
	}
}
