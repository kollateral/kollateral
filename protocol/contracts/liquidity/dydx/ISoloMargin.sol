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
pragma experimental ABIEncoderV2;

import "./Types.sol";

interface ISoloMargin {
    function operate(
        Types.AccountInfo[] memory accounts,
        Types.ActionArgs[] memory actions
    ) external;

    function getMarketIsClosing(uint256 marketId) external view returns (bool);

    function getMarketTokenAddress(uint256 marketId)
        external
        view
        returns (address);
}
