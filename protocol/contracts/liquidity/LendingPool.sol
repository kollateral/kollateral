// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";

contract LendingPool is Ownable {
	struct Lender {
		address pool;
		address feeCollectionAddress;
		uint256 feeBips;
	}

	mapping(address => Lender[]) internal lenders;

	uint256 internal platformFeeBips;

	address internal platformFeeCollectionAddress;

	constructor() {}

	function getPlatformFeeBips() external view returns (uint256) {
		return platformFeeBips;
	}

	function getPlatformFeeCollectionAddress() external view returns (address) {
		return platformFeeCollectionAddress;
	}

	function getLenders(address tokenAddress) external view returns (Lender[] memory) {
		return lenders[tokenAddress];
	}

	function setPlatformFeeBips(uint256 bips) external onlyOwner {
		platformFeeBips = bips;
	}

	function setPlatformFeeCollectionAddress(address _feeCollectionAddress) external onlyOwner {
		platformFeeCollectionAddress = _feeCollectionAddress;
	}

	function setLenders(address _tokenAddress, Lender[] memory _newLenders) external onlyOwner {
		delete lenders[_tokenAddress];
		for (uint256 index = 0; index < _newLenders.length; index++) {
			lenders[_tokenAddress].push(_newLenders[index]);
		}
	}
}
