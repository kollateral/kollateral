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

    THIS FILE IS FOR EXAMPLE ONLY AND IS NOT SUITABLE FOR PRODUCTION USE.
*/

pragma solidity ^0.5.0;

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@kollateral/contracts/invoke/KollateralInvokable.sol";
import "@kollateral/contracts/invoke/IInvoker.sol";

contract IErc20 {
    function approve(address spender, uint256 amount) public returns (bool);
}

contract IUniswapFactory {
    function getExchange(address token) external view returns (address exchange);
    function getToken(address exchange) external view returns (address token);
}

contract IUniswapExchange {
    function tokenToTokenSwapInput(uint256 tokens_sold, uint256 min_tokens_bought, uint256 min_eth_bought, uint256 deadline, address token_addr) external returns (uint256  tokens_bought);
}

contract IKyberNetworkProxy {
    function swapTokenToToken(address src, uint srcAmount, address dest, uint minConversionRate) public returns (uint);
}

contract DexArb is KollateralInvokable, Ownable {
    IInvoker internal _invoker;
    IUniswapFactory internal _uniswapFactory;
    IKyberNetworkProxy internal _kyberNetworkProxy;
    address internal _myVaultAddress;

    constructor (
        address invokerAddress,
        address uniswapFactoryAddress,
        address kyberNetworkProxyAddress,
        address myVaultAddress
    ) public {
        _invoker = IInvoker(invokerAddress);
        _uniswapFactory = IUniswapFactory(uniswapFactoryAddress);
        _kyberNetworkProxy = IKyberNetworkProxy(kyberNetworkProxyAddress);
        _myVaultAddress = myVaultAddress;
    }

    // Convenience function to all invocation directly from web3
    function arb(
        address sellTokenAddress,
        uint256 sellTokenAmount,
        address buyTokenAddress,
        uint256 deadline
    ) external {
        _invoker.invoke(
            address(this),
            abi.encode(sellTokenAddress, sellTokenAmount, buyTokenAddress, deadline),
            sellTokenAddress,
            sellTokenAmount);
    }

    // Kollateral hook implementation - can call directly using Kollateral TS lib or indirectly using arb()
    function execute(bytes calldata data) external payable {
        // lock down contract to only be callable by owner, preventing blind front-running
        require(currentSender() == owner(), "DexArb: only owner can call");

        // Decode parameters passed in through arb()
        (
            address sellTokenAddress,
            uint256 sellTokenAmount,
            address buyTokenAddress,
            uint256 deadline
        ) = abi.decode(data, (address, uint256, address, uint256));

        // Perform Uniswap sell
        IUniswapExchange uniswapPool = IUniswapExchange(_uniswapFactory.getExchange(sellTokenAddress));
        IErc20(sellTokenAddress).approve(address(uniswapPool), sellTokenAmount);
        uint256 tokensBought = uniswapPool.tokenToTokenSwapInput(sellTokenAmount, 0, 0, deadline, buyTokenAddress);

        // Perform Kyber buy
        IErc20(buyTokenAddress).approve(address(_kyberNetworkProxy), tokensBought);
        _kyberNetworkProxy.swapTokenToToken(buyTokenAddress, tokensBought, sellTokenAddress, 0);

        // Transfer excess sellToken to myVault
        if (balanceOf(sellTokenAddress) > currentRepaymentAmount()) {
            transfer(sellTokenAddress, _myVaultAddress, balanceOf(sellTokenAddress).sub(currentRepaymentAmount()));
        }

        // Repay Kollateral
        repay();
    }
}
