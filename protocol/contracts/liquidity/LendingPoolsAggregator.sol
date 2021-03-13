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

	function maxFlashLoan(address _token) external view override returns (uint256) {
		uint256 maxBalance = 0;

		for (uint256 i = 0; i < lenders[_token].length; i++) {
			IERC3156FlashLender lender = IERC3156FlashLender(lenders[_token][i].pool);
			maxBalance = maxBalance + lender.maxFlashLoan(_token);
		}

		return maxBalance;
	}

	function flashFee(address _token, uint256 _amount) external view override returns (uint256) {

		require(lenders[_token].length > 0, "LendingPoolsAggregator: Unsupported currency");

		require(
			_amount <= this.maxFlashLoan(_token),
			"LendingPoolsAggregator: Liquidity is not sufficient for requested amount"
		);

		uint256 loanFee = 0;
		uint256 remainingLoanBalance = _amount;

		for (uint256 i = 0; i < lenders[_token].length && remainingLoanBalance > 0; i++) {
			Lender memory lenderPool = lenders[_token][i];
			IERC3156FlashLender lender = IERC3156FlashLender(lenderPool.pool);
			uint256 loanAmount = loanableAmount(lender, _token, remainingLoanBalance);

			if (loanAmount > 0) {
				remainingLoanBalance = remainingLoanBalance - loanAmount;
				loanFee = loanFee + lender.flashFee(_token, loanAmount) + calculatePoolFee(loanAmount, lenderPool);
			}
		}

		return loanFee + calculatePlatformFee(_amount);
	}

	function flashLoan(
		IERC3156FlashBorrower _receiver,
		address _token,
		uint256 _amount,
		bytes calldata _data
	) external override returns (bool) {

		require(
			_amount <= this.maxFlashLoan(_token),
			"LendingPoolsAggregator: Liquidity is not sufficient for requested amount"
		);

		BorrowerData memory borrower = BorrowerData(_data, _amount, address(_receiver));
		FlashStepLoadData memory stepData = FlashStepLoadData(borrower, 0, _amount, 0);

		return executeFlashLoanStep(_token, stepData);
	}

	function executeFlashLoanStep(address _token, FlashStepLoadData memory _stepData) internal returns (bool) {

		IERC3156FlashLender lender = IERC3156FlashLender(lenders[_token][_stepData.step].pool);
		uint256 loanAmount = loanableAmount(lender, _token, _stepData.remainingAmount);

		if (loanAmount > 0) {
			IERC20(_token).approve(address(lender), loanAmount + lender.flashFee(_token, loanAmount));
			bytes memory stepEncodedData = abi.encode(_stepData);

			return lender.flashLoan(IERC3156FlashBorrower(address(this)), _token, loanAmount, stepEncodedData);
		} else {
			return executeNextFlashLoanStep(_token, _stepData);
		}
	}

	function onFlashLoan(
		address _initiator,
		address _token,
		uint256 _amount,
		uint256 _fee,
		bytes calldata _data
	) external override returns (bytes32) {

		require(_initiator == address(this), "Initiator must be LendingPoolAggregator");

		FlashStepLoadData memory stepData = abi.decode(_data, (FlashStepLoadData));
		require(stepData.step < lenders[_token].length, "Incorrect flash loan step id");

		Lender memory lender = lenders[_token][stepData.step];
		require(msg.sender == lender.pool, "Caller must be the Lender pool");

		uint256 poolFee = calculatePoolFee(_amount, lender);
		stepData.remainingAmount = stepData.remainingAmount - _amount;
		stepData.cumulativeFee = stepData.cumulativeFee + _fee + poolFee;

		if (stepData.remainingAmount > 0) {
			executeNextFlashLoanStep(_token, stepData);
		} else {
			concludeFlashLoan(stepData, _token);
		}

		IERC20(_token).transfer(lender.feeCollectionAddress, poolFee);

		return CALLBACK_SUCCESS;
	}

	function executeNextFlashLoanStep(address _token, FlashStepLoadData memory _stepData) internal returns (bool) {
		_stepData.step = _stepData.step + 1;
		return executeFlashLoanStep(_token, _stepData);
	}

	function concludeFlashLoan(FlashStepLoadData memory _stepData, address _token) internal {
		require(
			IERC20(_token).transfer(address(_stepData.borrower.receiver), _stepData.borrower.originalAmount),
			"FlashLender: Transfer failed"
		);

		uint256 platformFees = calculatePlatformFee(_stepData.borrower.originalAmount);
		uint256 totalFees = _stepData.cumulativeFee + platformFees;

		IERC3156FlashBorrower receiver = IERC3156FlashBorrower(_stepData.borrower.receiver);
		require(
			receiver.onFlashLoan(
				_stepData.borrower.receiver,
				_token,
				_stepData.borrower.originalAmount,
				totalFees,
				_stepData.borrower.callerData
			) == CALLBACK_SUCCESS,
			"IERC3156: Callback failed"
		);

		require(
			IERC20(_token).transferFrom(address(receiver), address(this), _stepData.borrower.originalAmount + totalFees),
			"FlashLender: Repay failed"
		);

		IERC20(_token).transfer(platformFeeCollectionAddress, platformFees);
	}

	function loanableAmount(
		IERC3156FlashLender _lender,
		address _token,
		uint256 _amount
	) internal view returns (uint256) {
		return Math.min(_lender.maxFlashLoan(_token), _amount);
	}

	function calculatePoolFee(uint256 _tokenAmount, Lender memory _lender) internal pure returns (uint256) {
		return (_tokenAmount * _lender.feeBips) / 10000;
	}

	function calculatePlatformFee(uint256 _tokenAmount) internal view returns (uint256) {
		return (_tokenAmount * platformFeeBips) / 10000;
	}
}
