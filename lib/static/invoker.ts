import { Network } from "./network";

const addressToTokenMap: Map<Network, string> = new Map([
  [Network.Mainnet, "0x06d1f34fd7C055aE5CA39aa8c6a8E10100a45c01"],
  [Network.Ropsten, "0x7d687C874FC20FF71A5da4b1896014CA648C7AE1"],
  [Network.Rinkeby, "0x5121e9a309Ce995E35995B35aa20048D655Fb182"]
]);

export class InvokerUtils {
  static getAddress(network: Network): string | null {
    if (!addressToTokenMap.has(network)) {
      return null;
    }
    return addressToTokenMap.get(network)!;
  }
}