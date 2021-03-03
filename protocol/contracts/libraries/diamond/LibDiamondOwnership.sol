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

import "./LibDiamondStorage.sol";

library LibDiamondOwnership {
	event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

	function setContractOwner(address _newOwner) internal {
		LibDiamondStorage.DiamondStorage storage ds = LibDiamondStorage.diamondStorage();

		address previousOwner = ds.contractOwner;
		require(previousOwner != _newOwner, "Previous owner and new owner must be different");

		ds.contractOwner = _newOwner;

		emit OwnershipTransferred(previousOwner, _newOwner);
	}

	function contractOwner() internal view returns (address contractOwner_) {
		contractOwner_ = LibDiamondStorage.diamondStorage().contractOwner;
	}

	function enforceIsContractOwner() internal view {
		require(msg.sender == LibDiamondStorage.diamondStorage().contractOwner, "Diamond: Must be contract owner");
	}

	/*
	 * Helpful modifier, Ownable-style
	 */
	modifier onlyOwner {
		require(msg.sender == LibDiamondStorage.diamondStorage().contractOwner, "Diamond: Must be contract owner");
		_;
	}
}
