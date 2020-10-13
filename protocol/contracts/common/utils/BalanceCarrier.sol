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

// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.7.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ExternalCaller.sol";

abstract contract BalanceCarrier is ExternalCaller {
    address private _ethTokenAddress;

    constructor(address ethTokenAddress) {
        _ethTokenAddress = ethTokenAddress;
    }

    function transfer(
        address tokenAddress,
        address to,
        uint256 amount
    ) internal returns (bool) {
        if (tokenAddress == _ethTokenAddress) {
            externalTransfer(to, amount);
            return true;
        } else {
            return IERC20(tokenAddress).transfer(to, amount);
        }
    }

    function balanceOf(address tokenAddress) internal view returns (uint256) {
        if (tokenAddress == _ethTokenAddress) {
            return address(this).balance;
        } else {
            return IERC20(tokenAddress).balanceOf(address(this));
        }
    }
}
