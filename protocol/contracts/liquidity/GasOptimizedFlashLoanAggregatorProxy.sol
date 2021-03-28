// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.2;

import "erc3156/contracts/interfaces/IERC3156FlashLender.sol";
import "./FlashLoanAggregatorProxy.sol";
import "./IFlashLoanAggregator.sol";
import "./QuickSort.sol";

contract GasOptimizedFlashLoanAggregatorProxy is FlashLoanAggregatorProxy {

	constructor(IFlashLoanAggregator _aggregator) FlashLoanAggregatorProxy(_aggregator, true) {}

	function sortLenders(IERC3156FlashLender[] memory _lenders, address _token) internal override {
		int[] memory liquidities = new int[](_lenders.length);
		uint[] memory indexes = new uint[](_lenders.length);

		for (uint i = 0; i < _lenders.length; i++) {
			indexes[i] = i;
			liquidities[i] = -int(_lenders[i].maxFlashLoan(_token));
		}

		QuickSort.quickSortByValues(indexes, liquidities);

		delete lenders[_token];

		for (uint i = 0; i < _lenders.length; i++) {
			lenders[_token].push(_lenders[indexes[i]]);
		}
	}

}
