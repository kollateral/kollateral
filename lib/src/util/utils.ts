import BN = require("bn.js");
import { BigNumber } from "bignumber.js";
import { AnyNumber } from "../models/const";

export class Utils {
  public static bigNumberToBN(value: BigNumber | string) {
    return new BN(new BigNumber(value).toFixed(), 10);
  }

  public static bnToBigNumber(value: BN) {
    return new BigNumber(value.toString(10), 10)
  }

  public static normalizeAddress(address: string) {
    const toLowerAddress = address.toLowerCase();
    if (toLowerAddress.startsWith('0x')) {
      return toLowerAddress;
    }
    return '0x' + toLowerAddress;
  }

  public static normalizeNumber(value: AnyNumber): BigNumber {
    if (value instanceof BN) {
      return Utils.bnToBigNumber(value);
    }
    if (value instanceof BigNumber) {
      return value;
    }

    return new BigNumber(value);
  }
}