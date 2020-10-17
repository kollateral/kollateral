import {BigNumber} from "bignumber.js";
import {Utils} from "./util/utils";
import {KingmakerConfig} from "./config/kingmaker";
import Web3 from "web3";
import {AbiItem} from "web3-utils";
import {Network, NetworkUtils} from "./static/network";
import {InvokerUtils} from "./static/invoker";
import {Token, TokenUtils} from "./static/tokens";
import {KTokenUtils} from "./static/ktokens";
import {Execution} from "./models/Invocation";
import {TokenAmount} from "./models/token-amount";
import {TransactionConfig} from "web3-core";
import {AnyNumber} from "./models/const";
import BN from "bn.js";

// @ts-ignore
import {TestToken} from "./generated/TestToken";
// @ts-ignore
import {KToken} from "./generated/KToken";
// @ts-ignore
import {Invoker} from "./generated/Invoker";
// @ts-ignore
import {KErc20} from "./generated/KErc20";
// @ts-ignore
import {KEther} from "./generated/KEther";

export class Kingmaker {
  public static MAX_UINT256: BigNumber =
    new BigNumber('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', 16);

  private _provider: any;
  private _config: KingmakerConfig;
  private _web3: Web3;
  private _invoker: Invoker;
  private _kEther: KEther;
  private _kErc20s: Map<string, KErc20>;
  private _kTokens: Map<string, KToken>;
  private _erc20Abi: AbiItem;

  constructor(provider: any, config: KingmakerConfig) {
    this._provider = provider;
    this._config = config;
    this._web3 = new Web3(provider);

    const invokerAbi = require('./abi/Invoker.json').abi;
    this._invoker = new this._web3.eth.Contract(invokerAbi, config.invokerAddress) as Invoker;

    const kEtherAbi = require('./abi/KEther.json').abi;
    this._kEther = new this._web3.eth.Contract(kEtherAbi, config.network.tokens.get(Token.ETH)!.kTokenAddress) as KEther;

    const kErc20Abi = require('./abi/KErc20.json').abi;
    this._kErc20s = new Map<string, KErc20>();

    const kTokenAbi = require('./abi/KToken.json').abi;
    this._kTokens = new Map<string, KToken>();

    this._erc20Abi = require('./abi/TestToken.json').abi;

    config.network.tokens.forEach((config, token) => {
      if (token != Token.ETH) {
        this._kErc20s.set(config.kTokenAddress, new this._web3.eth.Contract(kErc20Abi, config.kTokenAddress) as KErc20);
      }
      this._kTokens.set(config.kTokenAddress, new this._web3.eth.Contract(kTokenAbi, config.kTokenAddress) as KToken);
    });
  }

  static async init(provider: any): Promise<Kingmaker> {
    const networkId = await new Web3(provider).eth.net.getId();
    const network = NetworkUtils.fromId(networkId);

    /* Fail if not a complete static config available for network */
    if (!Kingmaker.isSupportedNetwork(network)) {
      throw("Unsupported Network");
    }

    const config: KingmakerConfig = {
      invokerAddress: InvokerUtils.getAddress(network)!,
      network: {
        network: network,
        tokens: new Map(TokenUtils.getSupportedTokens(network)
          .map(token => [token, {
            tokenAddress: TokenUtils.getAddress(network, token)!,
            kTokenAddress: KTokenUtils.getAddress(network, token)!
          }]))
      }
    };

    return new Kingmaker(provider, config);
  }

  static isSupportedNetwork(network: Network): boolean {
    return ([Network.Ropsten, Network.Rinkeby, Network.Mainnet].includes(network));
  }

  /* KToken Supplying */
  public unlock(sender: string, kTokenAddress: string): Promise<boolean> {
    return this.unlockAmount(sender, kTokenAddress, Kingmaker.MAX_UINT256);
  }

  public async unlockAmount(sender: string, kTokenAddress: string, amount: BigNumber): Promise<boolean> {
    const tokenAddress = await this._kTokens.get(kTokenAddress)!.methods.underlying().call();
    return this.tokenOf(tokenAddress).methods.approve(kTokenAddress, amount.toFixed()).send({
      from: sender
    });
  }

  public async allowance(owner: string, kTokenAddress: string): Promise<BigNumber> {
    const tokenAddress = await this._kTokens.get(kTokenAddress)!.methods.underlying().call();
    return this.tokenOf(tokenAddress).methods.allowance(owner, kTokenAddress).call().then((bn: BN) => Utils.bnToBigNumber(bn));
  }

  public async isUnlocked(owner: string, kTokenAddress: string): Promise<boolean> {
    const allowance = await this.allowance(owner, kTokenAddress);
    return allowance.eq(Kingmaker.MAX_UINT256);
  }

  public mint(sender: string, kTokenAddress: string, amount: BigNumber): Promise<boolean> {
    if (this.isKEtherAddress(kTokenAddress)) {
      return this._kEther.methods.mint().send({
        from: sender,
        value: amount.toFixed()
      });
    } else {
      return this._kErc20s.get(kTokenAddress)!.methods.mint(amount.toFixed()).send({
        from: sender
      });
    }
  }

  public redeem(sender: string, kTokenAddress: string, amount: BigNumber): Promise<boolean> {
    return this._kTokens.get(kTokenAddress)!.methods.redeem(amount.toFixed()).send({
      from: sender
    });
  }

  public redeemUnderlying(sender: string, kTokenAddress: string, amount: BigNumber): Promise<boolean> {
    return this._kTokens.get(kTokenAddress)!.methods.redeemUnderlying(amount.toFixed()).send({
      from: sender
    });
  }

  private isKEtherAddress(kTokenAddress: string): boolean {
    return kTokenAddress == this._config.network.tokens.get(Token.ETH)!.kTokenAddress;
  }

  public balanceOf(owner: string, tokenAddress: string): Promise<BigNumber> {
    return this.tokenOf(tokenAddress).methods.balanceOf(owner).call()
      .then((bn: BN) => Utils.bnToBigNumber(bn));
  }

  public balanceOfUnderlying(owner: string, kTokenAddress: string): Promise<BigNumber> {
    return this._kTokens.get(kTokenAddress)!.methods.balanceOfUnderlying(owner).call()
      .then((bn: BN) => Utils.bnToBigNumber(bn));
  }

  public underlyingAmountToNativeAmount(kTokenAddress: string, tokenAmount: BigNumber, ceiling = false): Promise<BigNumber> {
    return this._kTokens.get(kTokenAddress)!.methods.underlyingAmountToNativeAmount(tokenAmount.toFixed(), ceiling).call()
      .then((bn: BN) => Utils.bnToBigNumber(bn));
  }

  public nativeAmountToUnderlyingAmount(kTokenAddress: string, kTokenAmount: BigNumber): Promise<BigNumber> {
    return this._kTokens.get(kTokenAddress)!.methods.nativeAmountToUnderlyingAmount(kTokenAmount.toFixed()).call()
      .then((bn: BN) => Utils.bnToBigNumber(bn));
  }

  public totalSupply(tokenAddress: string): Promise<BigNumber> {
    return this.tokenOf(tokenAddress).methods.totalSupply().call()
      .then((bn: BN) => Utils.bnToBigNumber(bn));
  }

  public totalReserve(kTokenAddress: string): Promise<BigNumber> {
    return this._kTokens.get(kTokenAddress)!.methods.totalReserve().call()
      .then((bn: BN) => Utils.bnToBigNumber(bn));
  }

  private tokenOf(tokenAddress: string): TestToken {
    return new this._web3.eth.Contract(this._erc20Abi, tokenAddress) as TestToken;
  }

  /* Invocation */
  public async invoke(
    execution: Execution,
    tokenAmount: TokenAmount,
    txOpt: TransactionConfig = {}
  ): Promise<void> {
    if (txOpt.from == undefined) {
      txOpt.from = (await this._web3.eth.getAccounts())[0];
    }
    txOpt.value = this.valueOrDefault(execution.value).toFixed();

    const tokenAddress = this.getTokenAddressOrThrow(tokenAmount.token);
    return this._invoker.methods.invoke(
      execution.contract,
      this.dataOrDefault(execution.data),
      tokenAddress,
      Utils.normalizeNumber(tokenAmount.amount).toFixed()
    ).send(txOpt);
  }

  public totalLiquidity(token: Token): Promise<BigNumber> {
    const tokenAddress = this.getTokenAddressOrThrow(token);
    return this._invoker.methods.totalLiquidity(tokenAddress).call()
      .then((bn: BN) => Utils.bnToBigNumber(bn));
  }

  /* Testnet */
  public faucet(sender: string, tokenAmount: TokenAmount): Promise<boolean> {
    const tokenAddress = this.getTokenAddressOrThrow(tokenAmount.token);
    const token = new this._web3.eth.Contract(this._erc20Abi, tokenAddress) as TestToken;

    return token.methods.mint(Utils.normalizeNumber(tokenAmount.amount).toFixed()).send({
      from: sender
    });
  }

  /* Private */
  private getTokenAddressOrThrow(token: Token): string {
    if (!TokenUtils.isSupportedToken(this._config.network.network, token)) {
      throw("Unsupported token");
    }
    return TokenUtils.getAddress(this._config.network.network, token)!;
  }

  private valueOrDefault(value: AnyNumber | undefined): BigNumber {
    return Utils.normalizeNumber(value == undefined ? 0 : value);
  }

  private dataOrDefault(data: string | undefined): string | number[] {
    return data == undefined ? [] : data;
  }
}

export * from './static/tokens';
export * from './static/ktokens';
export * from './static/network';
export * from './static/invoker';
