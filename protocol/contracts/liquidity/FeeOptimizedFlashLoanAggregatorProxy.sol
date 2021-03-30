// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.2;

import "erc3156/contracts/interfaces/IERC3156FlashLender.sol";

import "./FlashLoanAggregatorProxy.sol";
import "./IFlashLoanAggregator.sol";
import "./QuickSort.sol";

contract FeeOptimizedFlashLoanAggregatorProxy is FlashLoanAggregatorProxy {
	constructor(IFlashLoanAggregator _aggregator) FlashLoanAggregatorProxy(_aggregator, false) {}

	function sortLenders(IERC3156FlashLender[] memory _lenders, address _token) internal override {
		int256[] memory fees = new int256[](_lenders.length);
		uint256[] memory indexes = new uint256[](_lenders.length);

		for (uint256 i = 0; i < _lenders.length; i++) {
			indexes[i] = i;
			fees[i] = int256(_lenders[i].flashFee(_token, 1000000));
		}

		QuickSort.quickSortByValues(indexes, fees);

		for (uint256 i = 0; i < _lenders.length; i++) {
			lenders[_token].push(_lenders[indexes[i]]);
		}
	}
}
