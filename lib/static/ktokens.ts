import { Network } from "./network";
import { Token } from "./tokens";

const kTokenToAddressMap: Map<Network, Map<Token, string>> = new Map([
  [Network.Ropsten, new Map([
    [Token.ETH, "0x0996AABB1d0143Ca0E80b169FaFa148cAd2282A5"],
    [Token.USDC, "0x3380746b6D42f92A1C1EA61a0f80166d1f0c700F"],
    [Token.DAI, "0x35a3494D8890130b9F92d62D611feC1D525429E6"]
  ])],
  [Network.Rinkeby, new Map([
    [Token.ETH, "0x2E112e9D94410f6246C9729DB0C491Cb73B73242"],
    [Token.USDC, "0xCaDF007f7a7805B9c60a26bB7a0F2AdBadB10d62"],
    [Token.DAI, "0xD9321a7C65D34429478aeD92Ae031A2cafAA0C03"]
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