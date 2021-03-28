// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.2;

import "erc3156/contracts/interfaces/IERC3156FlashLender.sol";
import "erc3156/contracts/interfaces/IERC3156FlashBorrower.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IFlashLoanAggregator.sol";

contract FlashLoanAggregatorProxy is IERC3156FlashLender, IERC3156FlashBorrower, Ownable {

	struct Receiver {
		bytes data;
		IERC3156FlashBorrower receiver;
	}

	bytes32 public immutable CALLBACK_SUCCESS = keccak256("ERC3156FlashBorrower.onFlashLoan");

	IFlashLoanAggregator internal aggregator;
	IERC3156FlashLender[] internal lenders;

	constructor(IFlashLoanAggregator _aggregator, IERC3156FlashLender[] memory _lenders) {
		aggregator = _aggregator;
		lenders = _lenders;
	}

	function setLenders(IERC3156FlashLender[] memory _lenders) external onlyOwner {
		lenders = _lenders;
	}

	function setAggregator(IFlashLoanAggregator _aggregator) external onlyOwner {
		aggregator = _aggregator;
	}

	function maxFlashLoan(address _token) external view override returns (uint256) {
		return aggregator.maxFlashLoan(_token, lenders);
	}

	function flashFee(address _token, uint256 _amount) external view override returns (uint256) {
		return aggregator.flashFee(_token, _amount, lenders);
	}

	function flashLoan(
		IERC3156FlashBorrower _receiver,
		address _token,
		uint256 _amount,
		bytes calldata _data
	) external override returns (bool) {
		bytes memory data = abi.encode(Receiver(_data, _receiver));
		return aggregator.flashLoan(IERC3156FlashBorrower(this), _token, _amount, lenders, data);
	}

	function onFlashLoan(
		address _initiator,
		address _token,
		uint256 _amount,
		uint256 _fee,
		bytes calldata _data
	) external override returns (bytes32) {

		require(_initiator == address(this), "Initiator must be FlashLoanAggregatorProxy");

		Receiver memory data = abi.decode(_data, (Receiver));

		require(
			IERC20(_token).transfer(address(data.receiver), _amount),
			"FlashLoanAggregatorProxy: Transfer failed"
		);

		require(
			data.receiver.onFlashLoan(address(this), _token, _amount, _fee, data.data) == CALLBACK_SUCCESS,
			"IERC3156: Callback failed"
		);

		require(
			IERC20(_token).transferFrom(address(data.receiver), address(this), _amount + _fee),
			"FlashLender: Repay failed"
		);

		return CALLBACK_SUCCESS;
	}

}