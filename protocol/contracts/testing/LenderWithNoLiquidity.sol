// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.2;

import "erc3156/contracts/interfaces/IERC3156FlashLender.sol";

contract LenderWithNoLiquidity is IERC3156FlashLender {

	constructor() {}

	function maxFlashLoan(
		address token
	) external view override returns (uint256) {
		return 0;
	}

	function flashFee(
		address token,
		uint256 amount
	) external view override returns (uint256) {

		require(
			false,
			"LendingPoolsAggregator: Unsupported currency"
		);

		return 0;
	}

	function flashLoan(
		IERC3156FlashBorrower receiver,
		address token,
		uint256 amount,
		bytes calldata data
	) external override returns (bool) {
		return false;
	}

}
