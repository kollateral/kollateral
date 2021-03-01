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

import "./LibDiamondStorage.sol";

import "../../interfaces/diamond/IDiamondCut.sol";

library LibDiamond {
	event DiamondCut(IDiamondCut.FacetCut[] _diamondCut, address _init, bytes _calldata);

	// Internal function version of diamondCut.
	// Like normal proxies you can also execute a function at the time of an upgrade.
	function diamondCut(
		IDiamondCut.FacetCut[] memory _diamondCut,
		address _init,
		bytes memory _calldata
	) internal {
		for (uint256 facetIndex; facetIndex < _diamondCut.length; facetIndex++) {
			IDiamondCut.FacetCutAction action = _diamondCut[facetIndex].action;
			if (action == IDiamondCut.FacetCutAction.Add) {
				addFunctions(_diamondCut[facetIndex].facetAddress, _diamondCut[facetIndex].functionSelectors);
			} else if (action == IDiamondCut.FacetCutAction.Replace) {
				replaceFunctions(_diamondCut[facetIndex].facetAddress, _diamondCut[facetIndex].functionSelectors);
			} else if (action == IDiamondCut.FacetCutAction.Remove) {
				removeFunctions(_diamondCut[facetIndex].facetAddress, _diamondCut[facetIndex].functionSelectors);
			} else {
				revert("DiamondCut: Incorrect FacetCutAction");
			}
		}
		emit DiamondCut(_diamondCut, _init, _calldata);
		initializeDiamondCut(_init, _calldata);
	}

	function addFunctions(address _facetAddress, bytes4[] memory _functionSelectors) internal {
		require(_functionSelectors.length > 0, "DiamondCut: No selectors in facet to cut");
		LibDiamondStorage.DiamondStorage storage ds = LibDiamondStorage.diamondStorage();
		// uint16 selectorCount = uint16(diamondStorage().selectors.length);
		require(_facetAddress != address(0), "DiamondCut: Add facet can't be address(0)");
		uint16 selectorPosition = uint16(ds.facetFunctionSelectors[_facetAddress].functionSelectors.length);
		// add new facet address if it does not exist
		if (selectorPosition == 0) {
			enforceHasContractCode(_facetAddress, "DiamondCut: New facet has no code");
			ds.facetFunctionSelectors[_facetAddress].facetAddressPosition = uint16(ds.facetAddresses.length);
			ds.facetAddresses.push(_facetAddress);
		}
		for (uint256 selectorIndex; selectorIndex < _functionSelectors.length; selectorIndex++) {
			bytes4 selector = _functionSelectors[selectorIndex];
			address oldFacetAddress = ds.selectorToFacetAndPosition[selector].facetAddress;
			require(oldFacetAddress == address(0), "DiamondCut: Can't add function that already exists");
			ds.facetFunctionSelectors[_facetAddress].functionSelectors.push(selector);
			ds.selectorToFacetAndPosition[selector].facetAddress = _facetAddress;
			ds.selectorToFacetAndPosition[selector].functionSelectorPosition = selectorPosition;
			selectorPosition++;
		}
	}

	function replaceFunctions(address _facetAddress, bytes4[] memory _functionSelectors) internal {
		require(_functionSelectors.length > 0, "DiamondCut: No selectors in facet to cut");
		LibDiamondStorage.DiamondStorage storage ds = LibDiamondStorage.diamondStorage();
		require(_facetAddress != address(0), "DiamondCut: Add facet can't be address(0)");
		uint16 selectorPosition = uint16(ds.facetFunctionSelectors[_facetAddress].functionSelectors.length);
		// add new facet address if it does not exist
		if (selectorPosition == 0) {
			enforceHasContractCode(_facetAddress, "DiamondCut: New facet has no code");
			ds.facetFunctionSelectors[_facetAddress].facetAddressPosition = uint16(ds.facetAddresses.length);
			ds.facetAddresses.push(_facetAddress);
		}
		for (uint256 selectorIndex; selectorIndex < _functionSelectors.length; selectorIndex++) {
			bytes4 selector = _functionSelectors[selectorIndex];
			address oldFacetAddress = ds.selectorToFacetAndPosition[selector].facetAddress;
			require(oldFacetAddress != _facetAddress, "DiamondCut: Can't replace function with same function");
			removeFunction(oldFacetAddress, selector);
			// add function
			ds.selectorToFacetAndPosition[selector].functionSelectorPosition = selectorPosition;
			ds.facetFunctionSelectors[_facetAddress].functionSelectors.push(selector);
			ds.selectorToFacetAndPosition[selector].facetAddress = _facetAddress;
			selectorPosition++;
		}
	}

	function removeFunctions(address _facetAddress, bytes4[] memory _functionSelectors) internal {
		require(_functionSelectors.length > 0, "DiamondCut: No selectors in facet to cut");
		LibDiamondStorage.DiamondStorage storage ds = LibDiamondStorage.diamondStorage();
		// if function does not exist then do nothing and return
		require(_facetAddress == address(0), "DiamondCut: Remove facet address must be address(0)");
		for (uint256 selectorIndex; selectorIndex < _functionSelectors.length; selectorIndex++) {
			bytes4 selector = _functionSelectors[selectorIndex];
			address oldFacetAddress = ds.selectorToFacetAndPosition[selector].facetAddress;
			removeFunction(oldFacetAddress, selector);
		}
	}

	function removeFunction(address _facetAddress, bytes4 _selector) internal {
		LibDiamondStorage.DiamondStorage storage ds = LibDiamondStorage.diamondStorage();
		require(_facetAddress != address(0), "DiamondCut: Can't remove function that doesn't exist");
		// an immutable function is a function defined directly in a diamond
		require(_facetAddress != address(this), "DiamondCut: Can't remove immutable function");
		// replace selector with last selector, then delete last selector
		uint256 selectorPosition = ds.selectorToFacetAndPosition[_selector].functionSelectorPosition;
		uint256 lastSelectorPosition = ds.facetFunctionSelectors[_facetAddress].functionSelectors.length - 1;
		// if not the same then replace _selector with lastSelector
		if (selectorPosition != lastSelectorPosition) {
			bytes4 lastSelector = ds.facetFunctionSelectors[_facetAddress].functionSelectors[lastSelectorPosition];
			ds.facetFunctionSelectors[_facetAddress].functionSelectors[selectorPosition] = lastSelector;
			ds.selectorToFacetAndPosition[lastSelector].functionSelectorPosition = uint16(selectorPosition);
		}
		// delete the last selector
		ds.facetFunctionSelectors[_facetAddress].functionSelectors.pop();
		delete ds.selectorToFacetAndPosition[_selector];

		// if no more selectors for facet address then delete the facet address
		if (lastSelectorPosition == 0) {
			// replace facet address with last facet address and delete last facet address
			uint256 lastFacetAddressPosition = ds.facetAddresses.length - 1;
			uint256 facetAddressPosition = ds.facetFunctionSelectors[_facetAddress].facetAddressPosition;
			if (facetAddressPosition != lastFacetAddressPosition) {
				address lastFacetAddress = ds.facetAddresses[lastFacetAddressPosition];
				ds.facetAddresses[facetAddressPosition] = lastFacetAddress;
				ds.facetFunctionSelectors[lastFacetAddress].facetAddressPosition = uint16(facetAddressPosition);
			}
			ds.facetAddresses.pop();
			delete ds.facetFunctionSelectors[_facetAddress].facetAddressPosition;
		}
	}

	function initializeDiamondCut(address _init, bytes memory _calldata) internal {
		if (_init == address(0)) {
			require(_calldata.length == 0, "DiamondCut: _init is address(0) but_calldata is not empty");
		} else {
			require(_calldata.length > 0, "DiamondCut: _calldata is empty but _init is not address(0)");
			if (_init != address(this)) {
				enforceHasContractCode(_init, "DiamondCut: _init address has no code");
			}
			(bool success, bytes memory error) = _init.delegatecall(_calldata);
			if (!success) {
				if (error.length > 0) {
					// bubble up the error
					revert(string(error));
				} else {
					revert("DiamondCut: _init function reverted");
				}
			}
		}
	}

	function enforceHasContractCode(address _contract, string memory _errorMessage) internal view {
		uint256 contractSize;
		assembly {
			contractSize := extcodesize(_contract)
		}
		require(contractSize > 0, _errorMessage);
	}
}
