// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.1;

import "./__oz__/access/Ownable.sol";
import "./__oz__/math/SafeMath.sol";
import "./__oz__/math/Math.sol";
import "./__oz__/token/ERC20/IERC20.sol";
import "erc3156/contracts/interfaces/IERC3156FlashLender.sol";
import "erc3156/contracts/interfaces/IERC3156FlashBorrower.sol";

contract LendingPoolsAggregator is IERC3156FlashLender, IERC3156FlashBorrower, Ownable {
	using SafeMath for uint256;

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

	mapping(address => address[]) internal _lenders;

	constructor() {}

	function setLenders(
		address tokenAddress,
		address[] calldata lenders
	) external onlyOwner {
		_lenders[tokenAddress] = lenders;
	}

	function maxFlashLoan(
		address token
	) external view override returns (uint256) {

		uint256 maxBalance = 0;

		for (uint256 i = 0; i < _lenders[token].length; i++) {
			IERC3156FlashLender lender = IERC3156FlashLender(_lenders[token][i]);
			maxBalance = maxBalance.add(lender.maxFlashLoan(token));
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

		uint256 loanFee = 0;
		uint256 remainingLoanBalance = amount;

		for (uint256 i = 0; i < _lenders[token].length && remainingLoanBalance > 0; i++) {

			IERC3156FlashLender lender = IERC3156FlashLender(_lenders[token][i]);
			uint256 loanAmount = loanableAmount(lender, token, remainingLoanBalance);

			if (loanAmount > 0) {
				remainingLoanBalance = remainingLoanBalance.sub(loanAmount);
				loanFee = loanFee.add(lender.flashFee(token, loanAmount));
			}
		}

		return loanFee;
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
		FlashStepLoadData memory stepData = FlashStepLoadData(borrower, amount, 0, 0);

		return executeFlashLoanStep(token, stepData);
	}

	function executeFlashLoanStep(
		address token,
		FlashStepLoadData memory stepData
	) internal returns (bool) {

		IERC3156FlashLender lender = IERC3156FlashLender(_lenders[token][stepData.step]);
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
		require(msg.sender == _lenders[token][stepData.step], "Caller must be the Lender pool");

		stepData.remainingAmount = stepData.remainingAmount.sub(amount);
		stepData.cumulativeFee = stepData.cumulativeFee.add(fee);

		if (stepData.remainingAmount > 0) {
			executeNextFlashLoanStep(token, stepData);
		} else {

			concludeFlashLoan(stepData, token);

			// distribute rewards
			// TODO

		}

		return keccak256("ERC3156FlashBorrower.onFlashLoan");
	}

	function concludeFlashLoan(
		FlashStepLoadData memory stepData,
		address token
	) internal {
		require(
			IERC20(token).transfer(address(stepData.borrower.receiver), stepData.borrower.originalAmount),
			"FlashLender: Transfer failed"
		);

		IERC3156FlashBorrower receiver = IERC3156FlashBorrower(stepData.borrower.receiver);
		require(
			receiver.onFlashLoan(
				stepData.borrower.receiver,
				token,
				stepData.borrower.originalAmount,
				stepData.cumulativeFee,
				stepData.borrower.callerData
			) == keccak256("ERC3156FlashBorrower.onFlashLoan"),
			"IERC3156: Callback failed"
		);

		require(
			IERC20(token).transferFrom(
				address(receiver),
				address(this),
				stepData.borrower.originalAmount.add(stepData.cumulativeFee)
			),
			"FlashLender: Repay failed"
		);
	}

	function loanableAmount(
		IERC3156FlashLender lender,
		address token,
		uint256 maxAmount
	) internal view returns (uint256) {
		uint256 maxLoan = lender.maxFlashLoan(token);
		return Math.min(maxLoan, maxAmount);
	}

	function executeNextFlashLoanStep(
		address token,
		FlashStepLoadData memory stepData
	) internal returns (bool) {
		stepData.step = stepData.step.add(1);
		return executeFlashLoanStep(token, stepData);
	}

}
