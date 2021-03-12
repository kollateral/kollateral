// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";

contract LendingPool is Ownable {

	struct Lender {
		address _address;
		address _feeCollectionAddress;
		uint256 _feeBips;
	}

	mapping(address => Lender[]) internal _lenders;

	uint256 internal _platformFeeBips;
	address internal _platformFeeCollectionAddress;

	constructor() {}

	function platformFeeBips() external view returns (uint256) {
		return _platformFeeBips;
	}

	function platformFeeCollectionAddress() external view returns (address) {
		return _platformFeeCollectionAddress;
	}

	function lenders(address tokenAddress) external view returns (Lender[] memory) {
		return _lenders[tokenAddress];
	}

	function setPlatformFeeBips(uint256 bips) external onlyOwner {
		_platformFeeBips = bips;
	}

	function setPlatformFeeCollectionAddress(address feeCollectionAddress) external onlyOwner {
		_platformFeeCollectionAddress = feeCollectionAddress;
	}

	function setLenders(
		address tokenAddress,
		Lender[] memory newLenders
	) external onlyOwner {
		delete _lenders[tokenAddress];
		for (uint256 index = 0; index < newLenders.length; index++) {
			_lenders[tokenAddress].push(newLenders[index]);
		}
	}

}
