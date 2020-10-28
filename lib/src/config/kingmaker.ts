import {NetworkConfig} from "./network";
export * from './network';
export * from './token';

export interface KingmakerConfig {
  invokerAddress: string
  network: NetworkConfig
}
