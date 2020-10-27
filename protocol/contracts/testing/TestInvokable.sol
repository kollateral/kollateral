/*

    Copyright 2020 Kollateral LLC
    Copyright 2020 ARM Finance LLC

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

pragma solidity ^0.7.0;

import "../common/invoke/KingmakerInvokable.sol";

contract TestInvokable is KingmakerInvokable {

    constructor() public { }

    event HelperDump(
        address sender,
        bytes32 dataHash,
        address currentTokenAddress,
        uint256 currentTokenAmount,
        uint256 currentRepaymentAmount,
        bool isCurrentTokenEther);
    event SwapDump(bytes swapData);

    // To setup state for specific tests
    function invoke(address invokeAddress, bytes calldata invokeData) external payable {
        externalCall(invokeAddress, msg.value, invokeData);
    }

    function execute(bytes calldata data) external override payable {
        emitHelper(data);

        if (data.length == 0) {
            return executeNoop();
        }

        (uint256 testType, bytes memory testData) = abi.decode(data, (uint256, bytes));
        if (testType == 1) {
            (uint256 repaymentAmount) = abi.decode(testData, (uint256));
            return executeRepayAmount(repaymentAmount);
        }
        if (testType == 3) {
            (address invokeAddress, bytes memory invokeData) = abi.decode(testData, (address, bytes));
            return executeInvoke(invokeAddress, invokeData);
        }
        if (testType == 4) {
            (uint256 amount) = abi.decode(testData, (uint256));
            return executePayable(amount);
        }
    }

    function executeNoop() internal {
        repay();
    }

    function executeRepayAmount(uint256 amount) internal {
        transfer(currentTokenAddress(), msg.sender, amount);
    }

    function executeInvoke(address invokeAddress, bytes memory invokeData) internal {
        externalCall(invokeAddress, msg.value, invokeData);
        repay();
    }

    function executePayable(uint256 amount) internal {
        require(msg.value == amount, "TestInvokable: did not forward value");
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

    fallback() external { }
}
