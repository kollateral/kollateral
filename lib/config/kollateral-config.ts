import { Token } from "../static/tokens";
import { Network } from "../static/network";

export interface KollateralConfig {
  invokerAddress: string
  network: NetworkConfig
}

export interface NetworkConfig {
  network: Network,
  tokens: Map<Token, TokenConfig>
}

export interface TokenConfig {
  tokenAddress: string,
  kTokenAddress: string
}