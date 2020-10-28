import { Token } from "../static/tokens";
import { AnyNumber } from "./const";

export interface TokenAmount {
  token: Token;
  amount: AnyNumber;
}