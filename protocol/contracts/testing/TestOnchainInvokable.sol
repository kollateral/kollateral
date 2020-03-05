/*

    Copyright 2020 Kollateral LLC.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/

pragma solidity ^0.5.0;

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "../common/invoke/KollateralInvokable.sol";

/*
 *  WARNING: ONLY FOR ON-CHAIN TESTING - THIS CONTRACT IS VULNERABLE TO LOSS OF FUNDS
 */
contract TestOnchainInvokable is KollateralInvokable, Ownable {
    constructor() public { }

    event HelperDump(address sender, bytes32 dataHash, address currentTokenAddress, uint256 currentTokenAmount,
        uint256 currentRepaymentAmount, bool isCurrentTokenEther);

    function () external payable { }

    function execute(bytes calldata data) external payable {
        emitHelper(data);

        repay();
    }

    function emitHelper(bytes memory data) internal {
        emit HelperDump(
            currentSender(),
            keccak256(data),
            currentTokenAddress(),
            currentTokenAmount(),
            currentRepaymentAmount(),
            isCurrentTokenEther());
    }

    function withdraw(address tokenAddress, address to, uint256 amount)
    external
    onlyOwner
    returns (bool)
    {
        return transfer(tokenAddress, msg.sender, amount);
    }
}
