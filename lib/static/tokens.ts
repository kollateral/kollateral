import {Network} from "./network";

export enum Token {
  ETH,
  USDC,
  DAI
}

const ETHER_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000001";

const tokenToAddressMap: Map<Network, Map<Token, string>> = new Map([
  [Network.Mainnet, new Map([
    [Token.ETH, ETHER_TOKEN_ADDRESS],
    [Token.USDC, "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"],
    [Token.DAI, "0x6b175474e89094c44da98b954eedeac495271d0f"]
  ])],
  [Network.Ropsten, new Map([
    [Token.ETH, ETHER_TOKEN_ADDRESS],
    [Token.USDC, "0x3008B7dCED223444993B0CFa682Dd4239c47ceC0"],
    [Token.DAI, "0x5072F93Aaf8F903B9a2c0683DAE211A18859331e"]
  ])],
  [Network.Rinkeby, new Map([
    [Token.ETH, ETHER_TOKEN_ADDRESS],
    [Token.USDC, "0xCC25B712689d98099f8F401608cd8931c1499878"],
    [Token.DAI, "0xC030da418B5c0832430c36c9f7cBDc417EeDe492"]
  ])]
]);

const addressToTokenMap: Map<Network, Map<string, Token>> =
  new Map(Array.from(tokenToAddressMap.entries())
    .map(kv => [kv[0], new Map(Array.from(kv[1].entries())
      .map(kv => [kv[1], kv[0]]))
    ]));

export class TokenUtils {
  static getAddress(network: Network, token: Token): string | null {
    if (!tokenToAddressMap.has(network)) {
      return null;
    }
    if (!tokenToAddressMap.get(network)!.has(token)) {
      return null;
    }
    return tokenToAddressMap.get(network)!.get(token)!;
  }

  static fromAddress(network: Network, tokenAddress: string): Token | null {
    if (!addressToTokenMap.has(network)) {
      return null;
    }
    if (!addressToTokenMap.get(network)!.has(tokenAddress)) {
      return null;
    }
    return addressToTokenMap.get(network)!.get(tokenAddress)!;
  }

  static getSupportedTokens(network: Network): Token[] {
    if (!addressToTokenMap.has(network)) {
      return [];
    }
    return Array.from(tokenToAddressMap.get(network)!.keys());
  }

  static isSupportedToken(network: Network, token: Token): boolean {
    if (!tokenToAddressMap.has(network)) {
      return false;
    }
    return tokenToAddressMap.get(network)!.has(token);
  }
}