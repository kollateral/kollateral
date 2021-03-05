// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.2;

import "./__oz__/math/Math.sol";
import "erc3156/contracts/interfaces/IERC3156FlashLender.sol";
import "./libraries/access/Ownable.sol";
import "./libraries/math/SafeMath.sol";

contract LendingPool is Ownable {

	using SafeMath for uint256;

	struct Lender {
		address _address;
		address _feeCollectionAddress;
		uint256 _feeBips;
	}

	mapping(address => Lender[]) internal _lenders;

	uint256 internal _platformFeeBips;
	address internal _platformFeeCollectionAddress;

	constructor() {}

	function platformFee() external view returns (uint256) {
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
		bytes calldata newLenders
	) external onlyOwner {
		(Lender[] memory items) = abi.decode(newLenders, (Lender[]));
		for (uint256 index = 0; index < items.length; index++) {
			_lenders[tokenAddress][index] = items[index];
		}
	}

	function loanableAmount(
		IERC3156FlashLender lender,
		address token,
		uint256 maxAmount
	) internal view returns (uint256) {
		uint256 maxLoan = lender.maxFlashLoan(token);
		return Math.min(maxLoan, maxAmount);
	}

	function calculatePoolFee(uint256 tokenAmount, Lender memory lender) internal pure returns (uint256) {
		return tokenAmount.mul(lender._feeBips).div(10000);
	}

	function calculatePlatformFee(uint256 tokenAmount) internal view returns (uint256) {
		return tokenAmount.mul(_platformFeeBips).div(10000);
	}

}
