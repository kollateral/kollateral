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
// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.2;

import "./libraries/diamond/LibDiamond.sol";
import "./libraries/diamond/LibDiamondOwnership.sol";

import "./interfaces/diamond/IDiamondLoupe.sol";
import "./interfaces/diamond/IDiamondCut.sol";
import "./interfaces/access/IERC173.sol";
import "./interfaces/introspection/IERC165.sol";

contract Crown {
	// more arguments are added to this struct
	// this avoids stack too deep errors
	struct CrownArgs {
		address king;
	}

	constructor(IDiamondCut.FacetCut[] memory _diamondCut, CrownArgs memory _args) payable {
		LibDiamond.diamondCut(_diamondCut, address(0), new bytes(0));
		LibDiamondOwnership.setContractOwner(_args.king);

		LibDiamondStorage.DiamondStorage storage ds = LibDiamondStorage.diamondStorage();

		// adding ERC165 data
		ds.supportedInterfaces[type(IERC165).interfaceId] = true;
		ds.supportedInterfaces[type(IDiamondCut).interfaceId] = true;
		ds.supportedInterfaces[type(IDiamondLoupe).interfaceId] = true;
		ds.supportedInterfaces[type(IERC173).interfaceId] = true;
	}

	// Find facet for function that is called and execute the
	// function if a facet is found and return any value.
	fallback() external payable {
		LibDiamondStorage.DiamondStorage storage ds;
		bytes32 position = LibDiamondStorage.DIAMOND_STORAGE_POSITION;

		assembly {
			ds.slot := position
		}

		address facet = ds.selectorToFacetAndPosition[msg.sig].facetAddress;
		require(facet != address(0), "Diamond: Function does not exist");

		assembly {
			calldatacopy(0, 0, calldatasize())
			let result := delegatecall(gas(), facet, 0, calldatasize(), 0, 0)
			returndatacopy(0, 0, returndatasize())
			switch result
				case 0 {
					revert(0, returndatasize())
				}
				default {
					return(0, returndatasize())
				}
		}
	}

	receive() external payable {}
}
