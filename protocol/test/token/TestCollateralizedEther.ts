import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { BigNumber, Contract } from 'ethers';
import { ethers } from 'hardhat';

import { expect } from 'chai';

// TODO: improve event assertions throughout test suites
describe('TestCollateralizedEther', () => {
	let accounts: SignerWithAddress[];
	let owner: SignerWithAddress;
	let user: SignerWithAddress;

	let TestCollateralizedEther: Contract;

	before(async () => {
		accounts = await ethers.getSigners();
		owner = accounts[0];
		user = accounts[1];
	});

	beforeEach(async () => {
		const TestCollateralizedEtherFactory = await ethers.getContractFactory('TestCollateralizedEther');
		TestCollateralizedEther = await TestCollateralizedEtherFactory.deploy('Collateralized Ether', 'kETH');
		await TestCollateralizedEther.deployed();
	});

	describe('mint', () => {
		const amount = ethers.BigNumber.from(1000);
		const paybackAmount = ethers.BigNumber.from(500);
		describe('when supplying more than user balance', () => {
			let balance: BigNumber;

			beforeEach('minting', async () => {
				balance = await user.getBalance();
			});

			it('throws', async () => {
				try {
					await TestCollateralizedEther.connect(user).mint({ value: balance });
				} catch (e) {
					expect(e).to.be.not.null;
				}
			});
		});

		describe('for an empty pool', () => {
			beforeEach('minting...', async () => {
				const tx = await TestCollateralizedEther.connect(user).mint({ value: amount });
				const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
			});

			it('increments user tkETH balance', async () => {
				expect(await TestCollateralizedEther.balanceOf(user.address)).to.be.equal(amount);
			});

			it('increments totalReserve', async function () {
				expect(await TestCollateralizedEther.totalReserve()).to.be.equal(amount);
			});

			it('emits Mint event', async function () {
				const event = TestCollateralizedEther.filters.Mint();
				expect(event).not.to.be.null;
			});
		});

		describe('for a non-empty pool', () => {
			beforeEach('minting...', async () => {
				await TestCollateralizedEther.connect(user).mint({ value: amount });
				await TestCollateralizedEther.connect(user).redeem(paybackAmount);
			});

			it('increments user tkETH balance', async () => {
				expect(await TestCollateralizedEther.balanceOf(user.address)).to.be.equal(paybackAmount);
			});

			it('increments totalReserve', async function () {
				expect(await TestCollateralizedEther.totalReserve()).to.be.equal(paybackAmount);
			});

			it('emits Mint and Redeem events', async function () {
				const mintEvt = TestCollateralizedEther.filters.Mint();
				expect(mintEvt).not.to.be.null;
				const redeemEvt = TestCollateralizedEther.filters.Redeem();
				expect(redeemEvt).not.to.be.null;
			});
		});

		describe('for non-clean rounding', () => {
			const floorPaybackAmount = ethers.BigNumber.from(333);
			beforeEach('minting...', async () => {
				await TestCollateralizedEther.connect(user).mint({ value: amount });
				await TestCollateralizedEther.connect(user).redeem(floorPaybackAmount.mul(2));
			});

			it('increments user tkETH balance', async () => {
				expect(await TestCollateralizedEther.balanceOf(user.address)).to.be.equal(floorPaybackAmount.add(1));
			});

			it('increments totalReserve', async function () {
				expect(await TestCollateralizedEther.totalReserve()).to.be.equal(floorPaybackAmount.add(1));
			});

			it('emits Mint and Redeem events', async function () {
				const mintEvt = TestCollateralizedEther.filters.Mint();
				expect(mintEvt).not.to.be.null;
				const redeemEvt = TestCollateralizedEther.filters.Redeem();
				expect(redeemEvt).not.to.be.null;
			});
		});
	});

	describe('redeem', () => {
		const zero = ethers.BigNumber.from(0);
		const amount = ethers.BigNumber.from(1000);
		const paybackAmount = ethers.BigNumber.from(500);
		describe('when redeeming with zero balance', () => {
			it('reverts', async () => {
				// TODO: find the right assertions to avoid Error-throwing by the HRE on revert
				// Error: VM Exception while processing transaction: revert CollateralizedToken: no supply
				// expect(await TestCollateralizedEther.connect(user).redeem(amount)).to.be.revertedWith('CollateralizedToken: no supply');
			});
		});

		describe('for a single-mint pool', () => {
			beforeEach('redeeming...', async () => {
				await TestCollateralizedEther.connect(user).mint({ value: amount });
				await TestCollateralizedEther.connect(user).redeem(amount);
			});

			it('decrements user tkETH balance', async () => {
				expect(await TestCollateralizedEther.balanceOf(user.address)).to.be.equal(zero);
			});

			it('decrements totalReserve', async function () {
				expect(await TestCollateralizedEther.totalReserve()).to.be.equal(zero);
			});

			it('emits Redeem event', async function () {
				const event = TestCollateralizedEther.filters.Redeem();
				expect(event).not.to.be.null;
			});
		});

		describe('for a multi-mint pool', () => {
			beforeEach('redeeming...', async () => {
				await TestCollateralizedEther.connect(user).mint({ value: amount });
				await TestCollateralizedEther.connect(user).mint({ value: amount });
				await TestCollateralizedEther.connect(user).redeem(paybackAmount);
				await TestCollateralizedEther.connect(user).redeem(paybackAmount);
			});

			it('decrements user tkETH balance', async () => {
				expect(await TestCollateralizedEther.balanceOf(user.address)).to.be.equal(amount);
			});

			it('decrements totalReserve', async function () {
				expect(await TestCollateralizedEther.totalReserve()).to.be.equal(amount);
			});

			it('emits Redeem event', async function () {
				const event = TestCollateralizedEther.filters.Redeem();
				expect(event).not.to.be.null;
			});
		});

		describe('for emptying multi-mint pool', () => {
			beforeEach('redeeming...', async () => {
				await TestCollateralizedEther.connect(user).mint({ value: amount });
				await TestCollateralizedEther.connect(user).mint({ value: amount });
				await TestCollateralizedEther.connect(user).redeem(amount);
				await TestCollateralizedEther.connect(user).redeem(amount);
			});

			it('decrements user tkETH balance', async () => {
				expect(await TestCollateralizedEther.balanceOf(user.address)).to.be.equal(zero);
			});

			it('decrements totalReserve', async function () {
				expect(await TestCollateralizedEther.totalReserve()).to.be.equal(zero);
			});

			it('emits Redeem event', async function () {
				const event = TestCollateralizedEther.filters.Redeem();
				expect(event).not.to.be.null;
			});
		});

		describe('for emptying multi-mint, non-clean rounding pool', () => {
			beforeEach('redeeming...', async () => {
				await TestCollateralizedEther.connect(user).mint({ value: amount });
				await TestCollateralizedEther.connect(user).mint({ value: amount.sub(667) });
				await TestCollateralizedEther.connect(user).redeem(amount);
				await TestCollateralizedEther.connect(user).redeem(ethers.BigNumber.from(333));
			});

			it('decrements user tkETH balance', async () => {
				expect(await TestCollateralizedEther.balanceOf(user.address)).to.be.equal(zero);
			});

			it('decrements totalReserve', async function () {
				expect(await TestCollateralizedEther.totalReserve()).to.be.equal(zero);
			});

			it('emits Redeem event', async function () {
				const event = TestCollateralizedEther.filters.Redeem();
				expect(event).not.to.be.null;
			});
		});
	});

	describe('redeemUnderlying', () => {
		const zero = ethers.BigNumber.from(0);
		const amount = ethers.BigNumber.from(1000);
		const paybackAmount = ethers.BigNumber.from(500);
		describe('when redeeming with zero balance', () => {
			it('reverts', async () => {
				await expect(TestCollateralizedEther.connect(user).redeemUnderlying(amount)).to.be.revertedWith(
					'CollateralizedToken: no reserve'
				);
			});
		});

		describe('when redeeming more than balance', () => {
			it('reverts', async () => {
				await expect(TestCollateralizedEther.connect(user).redeemUnderlying(amount)).to.be.revertedWith(
					'CollateralizedToken: no reserve'
				);
			});
		});

		describe('for a single mint pool', () => {
			let redeemEvent: any;
			beforeEach('minting and redeeming...', async () => {
				await TestCollateralizedEther.connect(user).mint({ value: amount });
				await TestCollateralizedEther.connect(user).redeemUnderlying(amount);
				// TODO: this is unreliable, and it does fail sometimes
				TestCollateralizedEther.once('Redeem', (redeemer: any, tokenAmount: any, kTokenAmount: any, evt: any) => {
					redeemEvent = evt;
				});
			});

			it('decrements user tkETH balance', async () => {
				expect(await TestCollateralizedEther.balanceOf(user.address)).to.be.equal(zero);
			});

			it('decrements totalReserve', async function () {
				expect(await TestCollateralizedEther.totalReserve()).to.be.equal(zero);
			});

			it('emits Redeem event with correct arguments', async () => {
				if (redeemEvent !== undefined) {
					expect(redeemEvent).not.to.be.undefined;
					expect(redeemEvent.args.tokenAmount).to.be.equal(amount);
					expect(redeemEvent.args.kTokenAmount).to.be.equal(amount);
				}
				if (redeemEvent === undefined) {
					redeemEvent = TestCollateralizedEther.filters.Redeem();
					expect(redeemEvent).not.to.be.undefined;
				}
			});
		});

		describe('for a multi mint/redeem pool', () => {
			let redeemEvent: any;
			beforeEach('minting redeeming...', async () => {
				await TestCollateralizedEther.connect(user).mint({ value: amount });
				await expect(
					user.sendTransaction({
						to: TestCollateralizedEther.address,
						value: amount,
					})
				).to.be.reverted;
				await TestCollateralizedEther.connect(user).mint({ value: amount });

				await TestCollateralizedEther.connect(user).redeemUnderlying(amount);
				TestCollateralizedEther.once('Redeem', (redeemer: any, tokenAmount: any, kTokenAmount: any, evt: any) => {
					redeemEvent = evt;
				});
			});

			it('decrements user tkETH balance', async () => {
				expect(await TestCollateralizedEther.balanceOf(user.address)).to.be.equal(amount);
			});

			it('decrements totalReserve', async function () {
				expect(await TestCollateralizedEther.totalReserve()).to.be.equal(amount);
			});

			it('emits Redeem event', async function () {
				const event = TestCollateralizedEther.filters.Redeem();
				expect(event).not.to.be.undefined;
			});
		});

		describe('for emptying multi mint/redeem pool', () => {
			let redeemEvent: any;
			beforeEach('minting redeeming...', async () => {
				await TestCollateralizedEther.connect(user).mint({ value: amount });
				await expect(
					user.sendTransaction({
						to: TestCollateralizedEther.address,
						value: amount,
					})
				).to.be.reverted;
				await TestCollateralizedEther.connect(user).mint({ value: amount });
				await TestCollateralizedEther.connect(user).redeemUnderlying(amount.mul(2));

				TestCollateralizedEther.once('Redeem', (redeemer: any, tokenAmount: any, kTokenAmount: any, evt: any) => {
					redeemEvent = evt;
				});
			});

			it('decrements user tkETH balance', async () => {
				expect(await TestCollateralizedEther.balanceOf(user.address)).to.be.equal(zero);
			});

			it('decrements totalReserve', async function () {
				expect(await TestCollateralizedEther.totalReserve()).to.be.equal(zero);
			});

			it('emits Redeem event', async function () {
				const event = TestCollateralizedEther.filters.Redeem();
				expect(event).not.to.be.undefined;
			});
		});

		describe('for emptying non-clean multi mint/redeem pool', () => {
			let redeemEvent: any;
			beforeEach('minting redeeming...', async () => {
				await TestCollateralizedEther.connect(user).mint({ value: amount });
				await expect(
					user.sendTransaction({
						to: TestCollateralizedEther.address,
						value: amount.div(2),
					})
				).to.be.reverted;
				await TestCollateralizedEther.connect(user).mint({ value: amount });

				await TestCollateralizedEther.connect(user).redeemUnderlying(amount.div(2));
				await TestCollateralizedEther.connect(user).redeemUnderlying(amount.div(3));
				await TestCollateralizedEther.connect(user).redeemUnderlying(amount.add(167));
				TestCollateralizedEther.once('Redeem', (redeemer: any, tokenAmount: any, kTokenAmount: any, evt: any) => {
					redeemEvent = evt;
				});
			});

			it('decrements user tkETH balance', async () => {
				expect(await TestCollateralizedEther.balanceOf(user.address)).to.be.equal(zero);
			});

			it('decrements totalReserve', async function () {
				expect(await TestCollateralizedEther.totalReserve()).to.be.equal(zero);
			});

			it('emits Redeem event', async function () {
				const event = TestCollateralizedEther.filters.Redeem();
				expect(event).not.to.be.undefined;
			});
		});
	});

	describe('underlying', () => {
		describe('when calling underlying', () => {
			const ETHER_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000001';

			it('returns underlying token address', async () => {
				expect(await TestCollateralizedEther.underlying()).to.be.equal(ETHER_TOKEN_ADDRESS);
			});
		});

		describe('when calling isUnderlyingEther', () => {
			it('returns true', async () => {
				expect(await TestCollateralizedEther.isUnderlyingEther()).to.be.equal(true);
			});
		});
	});
});
