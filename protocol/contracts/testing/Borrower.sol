// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.2;

import "erc3156/contracts/interfaces/IERC3156FlashLender.sol";
import "erc3156/contracts/interfaces/IERC3156FlashBorrower.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../liquidity/KingMaker.sol";

contract Borrower is IERC3156FlashBorrower {
	string myData = "my precious data";

	KingMaker aggregator;

	constructor(KingMaker _aggregator) {
		aggregator = _aggregator;
	}

	function borrow(address _token, uint256 _amount, IERC3156FlashLender[] memory _lenders) external {
		bytes memory data = abi.encode(myData);
		aggregator.flashLoan(this, _token, _amount, _lenders, data);
	}

	function onFlashLoan(
		address initiator,
		address token,
		uint256 amount,
		uint256 fee,
		bytes calldata data
	) external override returns (bytes32) {
		require(initiator == address(this), "Initiator must be the lending contract");

		string memory decoded = abi.decode(data, (string));
		require(keccak256(abi.encodePacked(decoded)) == keccak256(abi.encodePacked(myData)), "my data is not kept as is");

		IERC20(token).approve(msg.sender, amount + fee);

		return keccak256("ERC3156FlashBorrower.onFlashLoan");
	}
}
