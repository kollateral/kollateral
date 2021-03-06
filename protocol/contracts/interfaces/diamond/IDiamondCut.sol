/*

	Copyright 2020 Nick Mudge <nick@perfectabstractions.com> (https://twitter.com/mudgen)
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

/**
 * Each diamond cut is a powerful cutter used to alter diamond contracts (add, replace, remove facets).
 */
interface IDiamondCut {
	enum FacetCutAction { Add, Replace, Remove }
	// Add=0, Replace=1, Remove=2

	struct FacetCut {
		address facetAddress;
		FacetCutAction action;
		bytes4[] functionSelectors;
	}

	/// @notice Add/replace/remove any number of functions and optionally execute
	///         a function with delegatecall
	/// @param _diamondCut Contains the facet addresses and function selectors
	/// @param _init The address of the contract or facet to execute _calldata
	/// @param _calldata A function call, including function selector and arguments
	///                  _calldata is executed with delegatecall on _init
	function diamondCut(
		FacetCut[] calldata _diamondCut,
		address _init,
		bytes calldata _calldata
	) external;

	event DiamondCut(FacetCut[] _diamondCut, address _init, bytes _calldata);
}
