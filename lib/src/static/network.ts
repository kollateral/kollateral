export enum Network {
  Unknown,
  Mainnet,
  Ropsten,
  Rinkeby,
  Kovan
}

export class NetworkUtils {
  static fromId(networkId: number): Network {
    if (networkId == 1) {
      return Network.Mainnet;
    }
    if (networkId == 3) {
      return Network.Ropsten;
    }
    if (networkId == 4) {
      return Network.Rinkeby;
    }
    return Network.Unknown;
  }
}