/*

    Copyright 2020 Kollateral LLC
    Copyright 2020-2021 ARM Finance LLC

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
pragma solidity ^0.8.1;

contract ExternalCaller {
    function externalTransfer(address _to, uint256 _value) internal {
        require(address(this).balance >= _value, "ExternalCaller: insufficient ether balance");
        externalCall(_to, _value, "");
    }

    function externalCall(
        address _to,
        uint256 _value,
        bytes memory _data
    ) internal {
        (bool success, bytes memory returndata) = _to.call{ value: _value }(_data);
        require(success, string(returndata));
    }
}
