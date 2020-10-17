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

pragma solidity ^0.5.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./Ktoken.sol";
import "../token/CollateralizedEther.sol";

contract KEther is KToken, CollateralizedEther {
    constructor ()
    CollateralizedEther()
    ERC20Detailed("Kingmaker", "kMKR", 18)
    public
    { }

    function payableReserveAdjustment() internal returns (uint256) {
        return msg.value;
    }
}
