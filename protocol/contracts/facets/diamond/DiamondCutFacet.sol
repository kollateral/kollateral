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
pragma solidity ^0.8.2;

import "hardhat/console.sol";

import "../../libraries/diamond/LibDiamond.sol";
import "../../libraries/diamond/LibDiamondOwnership.sol";

import "../../interfaces/diamond/IDiamondCut.sol";

contract DiamondCutFacet is IDiamondCut {
	/// @notice Add/replace/remove any number of functions and optionally execute a function, with DELEGATECALL
	/// @param _diamondCut Contains the facet addresses and function selectors
	/// @param _init The address of the contract or facet to execute _calldata
	/// @param _callData A contract call with function selector and arguments is executed, with DELEGATECALL, at _init
	function diamondCut(
		FacetCut[] calldata _diamondCut,
		address _init,
		bytes calldata _callData
	) external override {
		LibDiamondOwnership.enforceIsContractOwner();
		LibDiamond.diamondCut(_diamondCut, _init, _callData);
	}
}
