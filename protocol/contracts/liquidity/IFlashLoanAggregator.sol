// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.2;

import "erc3156/contracts/interfaces/IERC3156FlashLender.sol";
import "erc3156/contracts/interfaces/IERC3156FlashBorrower.sol";

interface IFlashLoanAggregator {

	function maxFlashLoan(address _token, IERC3156FlashLender[] memory _lenders) external view returns (uint256);

	function flashFee(address _token, uint256 _amount, IERC3156FlashLender[] memory _lenders) external view returns (uint256);

	function flashLoan(
		IERC3156FlashBorrower _receiver,
		address _token,
		uint256 _amount,
		IERC3156FlashLender[] memory _lenders,
		bytes calldata _data
	) external returns (bool);

}
