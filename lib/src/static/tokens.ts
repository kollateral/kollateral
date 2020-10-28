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
    [Token.USDC, "0x5e8B3C9eE77C6951D4D91eF7510aAc60C5313638"],
    [Token.DAI, "0xD8FAE8336297A17180445F93b43B17b5b554c6dD"]
  ])],
  [Network.Rinkeby, new Map([
    [Token.ETH, ETHER_TOKEN_ADDRESS],
    [Token.USDC, "0x902cB36aa5F9B33E7d04E0D3F75ABC027c8E2DA7"],
    [Token.DAI, "0x21AD750D8Eac5Fc7278cf93De9Aa4e68eF261BF7"]
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