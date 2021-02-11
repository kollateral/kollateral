import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { BigNumber, Contract } from 'ethers';
import { ethers } from 'hardhat';

import { expect } from 'chai';
import { ParamType } from 'ethers/lib/utils';

const ETHER_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000001';
const OTHER_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000002';

function encodeExecute(type: any, abi: (string | ParamType)[], data: any[]) {
	const encodedData = ethers.utils.defaultAbiCoder.encode(abi, data);
	return ethers.utils.defaultAbiCoder.encode(['uint256', 'bytes'], [type, encodedData]);
}

describe('SoloLiquidityProxy', () => {
	let Invoker: Contract;
	let KingmakerLiquidityProxy: Contract;
	let MockSoloMargin: Contract;
	let SoloLiquidityProxy: Contract;
	let KEther: Contract;
	let TestToken: Contract;
	let WETH9: Contract;
	let KERC20: Contract;
	let TestInvokable: Contract;

	describe('for Ether borrows', () => {
		const noopInvokerBalance = ethers.BigNumber.from(10000);
		const kEtherUnderlyingBalance = ethers.BigNumber.from(100000);
		let invokerVaultStartingBalance: BigNumber;

		let owner: SignerWithAddress;
		let user: SignerWithAddress;
		let KEtherVault: SignerWithAddress;
		let InvokerVault: SignerWithAddress;
		before(async () => {
			const [addr1, addr2, addr3, addr4] = await ethers.getSigners();
			owner = addr1;
			user = addr2;
			KEtherVault = addr3;
			InvokerVault = addr4;
		});

		beforeEach(async () => {
			const WETH9Factory = await ethers.getContractFactory('WETH9');
			WETH9 = await WETH9Factory.connect(owner).deploy();
			await WETH9.deployed();

			const MockSoloMarginFactory = await ethers.getContractFactory('MockSoloMargin');
			MockSoloMargin = await MockSoloMarginFactory.connect(owner).deploy([0], [WETH9.address]);
			await MockSoloMargin.deployed();

			const SoloLiquidityProxyFactory = await ethers.getContractFactory('SoloLiquidityProxy');
			SoloLiquidityProxy = await SoloLiquidityProxyFactory.connect(owner).deploy(MockSoloMargin.address, WETH9.address);
			await SoloLiquidityProxy.deployed();
			await SoloLiquidityProxy.connect(owner).registerPool(0);

			const KEtherFactory = await ethers.getContractFactory('KEther');
			KEther = await KEtherFactory.connect(owner).deploy();
			await KEther.deployed();
			await KEther.connect(owner).setPlatformReward(5);
			await KEther.connect(owner).setPoolReward(20);
			await KEther.connect(owner).setPlatformVaultAddress(InvokerVault.address);

			const KingmakerLiquidityProxyFactory = await ethers.getContractFactory('KingmakerLiquidityProxy');
			KingmakerLiquidityProxy = await KingmakerLiquidityProxyFactory.connect(owner).deploy();
			await KingmakerLiquidityProxy.deployed();
			await KingmakerLiquidityProxy.connect(owner).registerPool(ETHER_TOKEN_ADDRESS, KEther.address);

			const InvokerFactory = await ethers.getContractFactory('Invoker');
			Invoker = await InvokerFactory.connect(owner).deploy();
			await Invoker.deployed();
			await Invoker.connect(owner).setLiquidityProxies(ETHER_TOKEN_ADDRESS, [
				SoloLiquidityProxy.address,
				KingmakerLiquidityProxy.address,
			]);
			await Invoker.connect(owner).setPlatformReward(5);
			await Invoker.connect(owner).setPoolReward(0);
			await Invoker.connect(owner).setPlatformVaultAddress(InvokerVault.address);

			const TestInvokableFactory = await ethers.getContractFactory('TestInvokable');
			TestInvokable = await TestInvokableFactory.connect(owner).deploy();
			await TestInvokable.deployed();
			const testInvokableTx = await owner.sendTransaction({
				value: noopInvokerBalance,
				to: TestInvokable.address,
			});

			await WETH9.deposit({ value: kEtherUnderlyingBalance.toString() });
			await WETH9.transfer(MockSoloMargin.address, kEtherUnderlyingBalance.toString());
			await KEther.mint({ value: kEtherUnderlyingBalance.toString() });
		});

		describe('invoke', () => {
			// TODO: dummy suite
			describe('when borrow single pool with successful repay', () => {
				const underlyingAmount = kEtherUnderlyingBalance;
				const underlyingBalanceRepayAmount = ethers.BigNumber.from(100051);
				const underlyingBalanceWithReward = ethers.BigNumber.from(100001);
				const resultingPlatformReward = ethers.BigNumber.from(100);
				const resultingPoolReward = ethers.BigNumber.from(0);
				let invocationReceipt: any;
				beforeEach('invoking...', async () => {
					invokerVaultStartingBalance = await InvokerVault.getBalance();
					invocationReceipt = await Invoker.invoke(TestInvokable.address, [], ETHER_TOKEN_ADDRESS, underlyingAmount);
				});

				it('increments Invoker vault balance', async () => {
					const invokerVaultFinalBalance = await InvokerVault.getBalance();
					expect(invokerVaultFinalBalance).to.be.equal(invokerVaultStartingBalance.add(50));
				});

				it('emits Reward event', async () => {
					const event = Invoker.filters.Reward();
					// TODO properly test event content
					expect(event).to.be.not.null;
				});

				it('emits Invocation event', async () => {
					const event = Invoker.filters.Invocation();
					// TODO properly test event content
					expect(event).to.be.not.null;
				});
			});
			// TODO: dummy suite
			describe('when borrow multi-pool with successful repay', () => {
				const underlyingAmount = kEtherUnderlyingBalance.div(2);
				const underlyingBalanceRepayAmount = ethers.BigNumber.from(100051 + 100300);
				const underlyingBalanceWithReward = ethers.BigNumber.from(100200 + 40);
				const resultingPlatformReward = ethers.BigNumber.from(100);
				const resultingPoolReward = ethers.BigNumber.from(0);
				let invocationReceipt: any;

				beforeEach('invoking...', async () => {
					invokerVaultStartingBalance = await InvokerVault.getBalance();
					invocationReceipt = await Invoker.invoke(TestInvokable.address, [], ETHER_TOKEN_ADDRESS, underlyingAmount);
				});

				it('increments Invoker vault balance', async () => {
					const invokerVaultFinalBalance = await InvokerVault.getBalance();
					expect(invokerVaultFinalBalance).to.be.equal(invokerVaultStartingBalance.add(25));
				});

				it('emits Reward event', async () => {
					const event = Invoker.filters.Reward();
					// TODO properly test event content
					expect(event).to.be.not.null;
				});

				it('emits Invocation event', async () => {
					const event = Invoker.filters.Invocation();
					// TODO properly test event content
					expect(event).to.be.not.null;
				});
			});
			// TODO: half-dummy suite
			describe('when borrow single pool with first proxy disabled successful repay', () => {
				const underlyingAmount = kEtherUnderlyingBalance;
				const underlyingBalanceRepayAmount = ethers.BigNumber.from(100300);
				const underlyingBalanceWithReward = ethers.BigNumber.from(100200);
				const resultingPlatformReward = ethers.BigNumber.from(50);
				const resultingPoolReward = ethers.BigNumber.from(0);
				let invocationReceipt: any;

				beforeEach('invoking...', async () => {
					await MockSoloMargin.setClosed(true);

					invokerVaultStartingBalance = await InvokerVault.getBalance();
					invocationReceipt = await Invoker.invoke(TestInvokable.address, [], ETHER_TOKEN_ADDRESS, underlyingAmount);
				});

				it('increments Invoker vault balance', async () => {
					const invokerVaultFinalBalance = await InvokerVault.getBalance();
					expect(invokerVaultFinalBalance).to.be.equal(invokerVaultStartingBalance.add(50));
				});

				it('emits Reward event', async () => {
					const event = Invoker.filters.Reward();
					// TODO properly test event content
					expect(event).to.be.not.null;
				});

				it('emits Invocation event', async () => {
					const event = Invoker.filters.Invocation();
					// TODO properly test event content
					expect(event).to.be.not.null;
				});
			});

			/*
			 * VIEWS
			 */
			describe('when calling totalLiquidity', () => {
				it('returns liquidity for registered token', async () => {
					expect(await Invoker.totalLiquidity(ETHER_TOKEN_ADDRESS)).to.be.equal(kEtherUnderlyingBalance.mul(2));
				});

				it('returns 0 for nonregistered token', async () => {
					expect(await Invoker.totalLiquidity(OTHER_TOKEN_ADDRESS)).to.be.equal(ethers.BigNumber.from(0));
				});
			});

			describe('when calling estimateRepaymentAmount', () => {
				it('returns correct amount for single pool', async () => {
					expect(await Invoker.estimateRepaymentAmount(ETHER_TOKEN_ADDRESS, kEtherUnderlyingBalance)).to.be.equal(
						ethers.BigNumber.from(100051)
					);
				});

				it('returns correct amount for multi pool', async () => {
					expect(await Invoker.estimateRepaymentAmount(ETHER_TOKEN_ADDRESS, kEtherUnderlyingBalance.mul(2))).to.be.equal(
						ethers.BigNumber.from(200351)
					);
				});

				it('reverts for too high amount', async () => {
					await expect(Invoker.estimateRepaymentAmount(ETHER_TOKEN_ADDRESS, kEtherUnderlyingBalance.mul(3))).to.be.revertedWith(
						'Invoker: not enough liquidity'
					);
				});

				it('reverts for non-registered tokens', async () => {
					await expect(Invoker.estimateRepaymentAmount(OTHER_TOKEN_ADDRESS, ethers.BigNumber.from(0))).to.be.revertedWith(
						'Invoker: no liquidity for token'
					);
				});
			});
		});
	});
});
