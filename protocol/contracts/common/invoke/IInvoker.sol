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

import "./IInvocationHook.sol";

contract IInvoker is IInvocationHook {
    function invoke(address invokeTo, bytes calldata invokeData, address tokenAddress, uint256 tokenAmount)
    external
    payable;

    function invokeCallback() external;

    function poolReward() external view returns (uint256);

    function poolRewardAddress(address tokenAddress) external view returns (address);

    function platformReward() external view returns (uint256);

    function platformVaultAddress() external view returns (address);

    function isTokenAddressRegistered(address tokenAddress) public view returns (bool);

    function totalLiquidity(address tokenAddress) external view returns (uint256);
}
