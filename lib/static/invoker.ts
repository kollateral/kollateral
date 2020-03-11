import { Network } from "./network";

const addressToTokenMap: Map<Network, string> = new Map([
  [Network.Mainnet, "0x06d1f34fd7C055aE5CA39aa8c6a8E10100a45c01"],
  [Network.Ropsten, "0x234A76352e816c48098F20F830A21c820085b902"],
  [Network.Rinkeby, "0x6523B8FE598D7c590Fa91BEd6234C0121cf2ee66"]
]);

export class InvokerUtils {
  static getAddress(network: Network): string | null {
    if (!addressToTokenMap.has(network)) {
      return null;
    }
    return addressToTokenMap.get(network)!;
  }
}