import { Network } from "./network";
import { Token } from "./tokens";

const kTokenToAddressMap: Map<Network, Map<Token, string>> = new Map([
  [Network.Ropsten, new Map([
    [Token.ETH, "0x23a5Aa74be1f3885956DeCea703131D5D31054E2"],
    [Token.USDC, "0xf15120717D7826531bBD1e7AF43EF10b6434FA83"],
    [Token.DAI, "0xbDf6f94BA6b31D71472B6C5a9a52b6A41b083d7e"]
  ])],
  [Network.Rinkeby, new Map([
    [Token.ETH, "0x8A21157a56B81c31576B334796D2B200a882Dc57"],
    [Token.USDC, "0xb757fdcEB7c3F064042752c288B390e4F0C6b064"],
    [Token.DAI, "0x32b6Ac4f39cBA086E4242Ca416E78463c1FFFcf4"]
  ])]
]);

const addressToKTokenMap: Map<Network, Map<string, Token>> =
  new Map(Array.from(kTokenToAddressMap.entries())
    .map(kv => [kv[0], new Map(Array.from(kv[1].entries())
      .map(kv => [kv[1], kv[0]]))
    ]));

export class KTokenUtils {
  static getAddress(network: Network, token: Token): string | null {
    if (!kTokenToAddressMap.has(network)) {
      return null;
    }
    if (!kTokenToAddressMap.get(network)!.has(token)) {
      return null;
    }
    return kTokenToAddressMap.get(network)!.get(token)!;
  }

  static fromAddress(network: Network, kTokenAddress: string): Token | null {
    if (!addressToKTokenMap.has(network)) {
      return null;
    }
    if (!addressToKTokenMap.get(network)!.has(kTokenAddress)) {
      return null;
    }
    return addressToKTokenMap.get(network)!.get(kTokenAddress)!;
  }
}