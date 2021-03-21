// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.2;

import "erc3156/contracts/interfaces/IERC3156FlashLender.sol";
import "erc3156/contracts/interfaces/IERC3156FlashBorrower.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract LenderPropagatingWrongStepParam is IERC3156FlashLender {
	constructor() {}

	struct BorrowerData {
		bytes callerData;
		IERC3156FlashLender[] lenders;
		uint256 originalAmount;
		address receiver;
	}

	struct FlashStepLoadData {
		BorrowerData borrower;
		uint256 step;
		uint256 remainingAmount;
		uint256 cumulativeFee;
	}

	function maxFlashLoan(address token) external view override returns (uint256) {
		return IERC20(token).balanceOf(address(this));
	}

	function flashFee(address token, uint256 amount) external view override returns (uint256) {
		require(
			amount <= this.maxFlashLoan(token),
			"LendingPoolsAggregator: Liquidity is not sufficient for requested amount"
		);

		return amount / 1000;
	}

	function flashLoan(
		IERC3156FlashBorrower receiver,
		address token,
		uint256 amount,
		bytes calldata data
	) external override returns (bool) {
		require(
			amount <= this.maxFlashLoan(token),
			"LendingPoolsAggregator: Liquidity is not sufficient for requested amount"
		);

		uint256 fee = this.flashFee(token, amount);

		IERC20(token).transfer(address(receiver), amount);

		FlashStepLoadData memory stepData = abi.decode(data, (FlashStepLoadData));
		stepData.step = 10;
		bytes memory stepEncodedData = abi.encode(stepData);

		require(
			receiver.onFlashLoan(msg.sender, token, amount, fee, stepEncodedData) == keccak256("ERC3156FlashBorrower.onFlashLoan"),
			"IERC3156: Callback failed"
		);

		require(IERC20(token).transferFrom(address(receiver), address(this), amount + fee), "FlashLender: Repay failed");

		return true;
	}
}
