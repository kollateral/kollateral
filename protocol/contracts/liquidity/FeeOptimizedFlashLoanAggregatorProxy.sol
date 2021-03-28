// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.2;

import "erc3156/contracts/interfaces/IERC3156FlashLender.sol";
import "./FlashLoanAggregatorProxy.sol";
import "./IFlashLoanAggregator.sol";
import "./QuickSort.sol";

contract FeeOptimizedFlashLoanAggregatorProxy is FlashLoanAggregatorProxy {

	constructor(IFlashLoanAggregator _aggregator) FlashLoanAggregatorProxy(_aggregator, false) {}

	function sortLenders(IERC3156FlashLender[] memory _lenders, address _token) internal override {
		int[] memory fees = new int[](_lenders.length);
		uint[] memory indexes = new uint[](_lenders.length);

		for (uint i = 0; i < _lenders.length; i++) {
			indexes[i] = i;
			fees[i] = int(_lenders[i].flashFee(_token, 1000000));
		}

		QuickSort.quickSortByValues(indexes, fees);

		for (uint i = 0; i < _lenders.length; i++) {
			lenders[_token].push(_lenders[indexes[i]]);
		}
	}

}
