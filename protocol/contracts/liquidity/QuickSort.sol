// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.2;

library QuickSort {

	function quickSortByValues(uint[] memory indexes, int[] calldata values) external pure {
		if (indexes.length > 1) {
			sortByValues(indexes, values, 0, indexes.length - 1);
		}
	}

	function sortByValues(uint[] memory indexes, int[] calldata values, uint low, uint high) internal pure {
		if (low < high) {
			int pivotVal = values[indexes[(low + high) / 2]];

			uint low1 = low;
			uint high1 = high;
			for (;;) {
				while (values[indexes[low1]] < pivotVal) low1++;
				while (values[indexes[high1]] > pivotVal) high1--;
				if (low1 >= high1) break;
				(indexes[low1], indexes[high1]) = (indexes[high1], indexes[low1]);
				low1++;
				high1--;
			}
			if (low < high1) sortByValues(indexes, values, low, high1);
			high1++;
			if (high1 < high) sortByValues(indexes, values, high1, high);
		}
	}

}
