// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.2;

import "erc3156/contracts/interfaces/IERC3156FlashLender.sol";
import "erc3156/contracts/interfaces/IERC3156FlashBorrower.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./LendingPool.sol";

contract LendingPoolsAggregator is LendingPool, IERC3156FlashLender, IERC3156FlashBorrower {

	bytes32 public immutable CALLBACK_SUCCESS = keccak256("ERC3156FlashBorrower.onFlashLoan");

	struct BorrowerData {
		bytes callerData;
		uint256 originalAmount;
		address receiver;
	}

	struct FlashStepLoadData {
		BorrowerData borrower;
		uint256 step;
		uint256 remainingAmount;
		uint256 cumulativeFee;
	}

	constructor() {}

	function maxFlashLoan(
		address token
	) external view override returns (uint256) {

		uint256 maxBalance = 0;

		for (uint256 i = 0; i < _lenders[token].length; i++) {
			IERC3156FlashLender lender = IERC3156FlashLender(_lenders[token][i]._address);
			maxBalance = maxBalance + lender.maxFlashLoan(token);
		}

		return maxBalance;
	}

	function flashFee(
		address token,
		uint256 amount
	) external view override returns (uint256) {

		require(
			_lenders[token].length > 0,
			"LendingPoolsAggregator: Unsupported currency"
		);

		require(
			amount <= this.maxFlashLoan(token),
			"LendingPoolsAggregator: Liquidity is not sufficient for requested amount"
		);

		uint256 loanFee = 0;
		uint256 remainingLoanBalance = amount;

		for (uint256 i = 0; i < _lenders[token].length && remainingLoanBalance > 0; i++) {
			Lender memory lenderPool = _lenders[token][i];
			IERC3156FlashLender lender = IERC3156FlashLender(lenderPool._address);
			uint256 loanAmount = loanableAmount(lender, token, remainingLoanBalance);

			if (loanAmount > 0) {
				remainingLoanBalance = remainingLoanBalance - loanAmount;
				loanFee = loanFee +
						  lender.flashFee(token, loanAmount) +
				          calculatePoolFee(loanAmount, lenderPool);
			}
		}

		return loanFee + calculatePlatformFee(amount);
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

		BorrowerData memory borrower = BorrowerData(data, amount, address(receiver));
		FlashStepLoadData memory stepData = FlashStepLoadData(borrower, 0, amount, 0);

		return executeFlashLoanStep(token, stepData);
	}

	function executeFlashLoanStep(
		address token,
		FlashStepLoadData memory stepData
	) internal returns (bool) {

		IERC3156FlashLender lender = IERC3156FlashLender(_lenders[token][stepData.step]._address);
		uint256 loanAmount = loanableAmount(lender, token, stepData.remainingAmount);

		if (loanAmount > 0) {
			IERC20(token).approve(address(lender), loanAmount + lender.flashFee(token, loanAmount));
			bytes memory stepEncodedData = abi.encode(stepData);

			return lender.flashLoan(IERC3156FlashBorrower(address(this)), token, loanAmount, stepEncodedData);
		} else {
			return executeNextFlashLoanStep(token, stepData);
		}
	}

	function onFlashLoan(
		address initiator,
		address token,
		uint256 amount,
		uint256 fee,
		bytes calldata data
	) external override returns (bytes32) {

		require(initiator == address(this), "Initiator must be LendingPoolAggregator");

		(FlashStepLoadData memory stepData) = abi.decode(data, (FlashStepLoadData));
		require(stepData.step < _lenders[token].length, "Incorrect flash loan step id");

		Lender memory lender = _lenders[token][stepData.step];
		require(msg.sender == lender._address, "Caller must be the Lender pool");

		uint256 poolFee = calculatePoolFee(amount, lender);
		stepData.remainingAmount = stepData.remainingAmount - amount;
		stepData.cumulativeFee = stepData.cumulativeFee + fee + poolFee;

		if (stepData.remainingAmount > 0) {
			executeNextFlashLoanStep(token, stepData);
		} else {
			concludeFlashLoan(stepData, token);
		}

		IERC20(token).transfer(lender._feeCollectionAddress, poolFee);

		return CALLBACK_SUCCESS;
	}

	function executeNextFlashLoanStep(
		address token,
		FlashStepLoadData memory stepData
	) internal returns (bool) {
		stepData.step = stepData.step + 1;
		return executeFlashLoanStep(token, stepData);
	}

	function concludeFlashLoan(
		FlashStepLoadData memory stepData,
		address token
	) internal {

		require(
			IERC20(token).transfer(address(stepData.borrower.receiver), stepData.borrower.originalAmount),
			"FlashLender: Transfer failed"
		);

		uint256 platformFees = calculatePlatformFee(stepData.borrower.originalAmount);
		uint256 totalFees = stepData.cumulativeFee + platformFees;

		IERC3156FlashBorrower receiver = IERC3156FlashBorrower(stepData.borrower.receiver);
		require(
			receiver.onFlashLoan(
				stepData.borrower.receiver,
				token,
				stepData.borrower.originalAmount,
				totalFees,
				stepData.borrower.callerData
			) == CALLBACK_SUCCESS,
			"IERC3156: Callback failed"
		);

		require(
			IERC20(token).transferFrom(
				address(receiver),
				address(this),
				stepData.borrower.originalAmount + totalFees
			),
			"FlashLender: Repay failed"
		);

		IERC20(token).transfer(_platformFeeCollectionAddress, platformFees);
	}

	function loanableAmount(
		IERC3156FlashLender lender,
		address token,
		uint256 amount
	) internal view returns (uint256) {
		return Math.min(lender.maxFlashLoan(token), amount);
	}

	function calculatePoolFee(uint256 tokenAmount, Lender memory lender) internal pure returns (uint256) {
		return tokenAmount * lender._feeBips / 10000;
	}

	function calculatePlatformFee(uint256 tokenAmount) internal view returns (uint256) {
		return tokenAmount * _platformFeeBips / 10000;
	}

}
