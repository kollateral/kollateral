import { Token } from "../static/tokens";
import { Network } from "../static/network";
import {TokenConfig} from "./token";

export interface NetworkConfig {
  network: Network,
  tokens: Map<Token, TokenConfig>
}
