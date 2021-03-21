// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";

contract PlatformFeesManager is Ownable {

	uint256 internal platformFeeBips;

	address internal platformFeeCollectionAddress;

	constructor(uint256 _bips, address _treasury) {
		platformFeeBips = _bips;
		platformFeeCollectionAddress = _treasury;
	}

	function getPlatformFeeBips() external view returns (uint256) {
		return platformFeeBips;
	}

	function getPlatformFeeCollectionAddress() external view returns (address) {
		return platformFeeCollectionAddress;
	}

	function setPlatformFeeBips(uint256 _bips) external onlyOwner {
		platformFeeBips = _bips;
	}

	function setPlatformFeeCollectionAddress(address _treasury) external onlyOwner {
		platformFeeCollectionAddress = _treasury;
	}

	function calculatePlatformFee(uint256 _tokenAmount) external view returns (uint256) {
		return (_tokenAmount * this.getPlatformFeeBips()) / 10000;
	}
}
