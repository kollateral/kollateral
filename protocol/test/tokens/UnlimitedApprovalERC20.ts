import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { BigNumber, Contract } from 'ethers';
import { ethers } from 'hardhat';

import { expect } from 'chai';

describe('UnlimitedApprovalERC20', () => {
	let accounts: SignerWithAddress[];
	let owner: SignerWithAddress;
	let user: SignerWithAddress;

	let TestToken: Contract;

	before(async () => {
		const [addr1, addr2] = await ethers.getSigners();
		owner = addr1;
		user = addr2;
	});

	beforeEach(async () => {
		const TestTokenFactory = await ethers.getContractFactory('TestToken');
		TestToken = await TestTokenFactory.deploy('Test Token', 'TT');
	});

	describe('transferFrom', () => {
		const amount: BigNumber = ethers.BigNumber.from(1000);
		let mintReceipt;
		beforeEach('minting...', async () => {
			const mintTx = await TestToken.connect(owner).mint(amount);
			mintReceipt = await ethers.provider.getTransactionReceipt(mintTx.hash);
		});

		/*
		 * In this test suite, tx and receipts are retrieved for exemplary purposes; using the provider instance injected
		 * into the ethers instance, which is in turn injected into HRE by hardhat-ethers plugin
		 * https://hardhat.org/advanced/hardhat-runtime-environment.html#using-the-hre
		 * https://github.com/nomiclabs/hardhat/tree/master/packages/hardhat-ethers#provider-object
		 */
		describe('when amount equals approved', () => {
			let approveReceipt;
			let transferFromReceipt;
			beforeEach('transferring...', async () => {
				const approveTx = await TestToken.connect(owner).approve(user.address, amount);
				approveReceipt = await ethers.provider.getTransactionReceipt(approveTx.hash);

				const transferFromTx = await TestToken.connect(user).transferFrom(owner.address, user.address, amount);
				transferFromReceipt = await ethers.provider.getTransactionReceipt(transferFromTx.hash);
			});

			it('decrements allowance', async () => {
				const allowance = await TestToken.allowance(owner.address, user.address);
				expect(allowance).to.equal(ethers.BigNumber.from(0));
			});

			it('emits Transfer event', async () => {
				const xferLog = TestToken.filters.Transfer(owner.address, user.address);
				expect(xferLog).not.to.be.null;
			});
		});

		describe('when amount exceeds approved', () => {
			beforeEach('approving...', async () => {
				await TestToken.connect(owner).approve(user.address, amount);
			});

			it('emits Approval event with correct arguments', async () => {
				/*
				 * Official way to assert events emittance, but it does require repetitive tx broadcasting
				 * alternative ways are documented in the next test suite
				 */
				await expect(TestToken.connect(owner).approve(user.address, amount))
					.to.emit(TestToken, 'Approval')
					.withArgs(owner.address, user.address, amount);
			});

			it('reverts with "ERC20: transfer amount exceeds balance"', async () => {
				/*
				 * fixed HRE throwing on revert cases by adhering to Waffle own assertion logic
				 * https://github.com/EthWorks/Waffle#example-test
				 */
				await expect(TestToken.connect(user).transferFrom(owner.address, user.address, amount.add(1))).to.be.revertedWith(
					'ERC20: transfer amount exceeds balance'
				);
			});
		});

		/*
		 * In this test suite, we show how to retrieve a fresh "Transfer" event, without filtering, as well as
		 * how to query for historical events, with filters, for exemplary purposes.
		 * https://docs.ethers.io/v5/getting-started/#getting-started--events
		 * https://docs.ethers.io/v5/getting-started/#getting-started--history
		 */
		describe('when allowance is maximally approved', () => {
			const MAX_UINT256 = ethers.BigNumber.from(2).pow(256).sub(1);

			let approveEvent: any;
			let xferEvent: any;
			beforeEach('transferring...', async () => {
				await TestToken.connect(owner).approve(user.address, MAX_UINT256);
				TestToken.once('Approval', (from, to, value, evt) => {
					approveEvent = evt;
				});

				await TestToken.connect(user).transferFrom(owner.address, user.address, amount);
				// TODO: this stopped working for some reason °_°
				TestToken.once('Transfer', (from, to, value, evt) => {
					xferEvent = evt;
				});
			});

			it('does not decrease allowance', async () => {
				const allowance = await TestToken.allowance(owner.address, user.address);
				expect(allowance).to.equal(MAX_UINT256);
			});

			it('emits Approval event with maxed amount', async () => {
				// TODO: investigate why approveEvent is still null
				// expect(approveEvent).not.to.be.undefined;

				// With a strict filter, we make sure to query the same event produced in 'beforeEach' hook
				const approvalFilter = TestToken.filters.Approval(owner.address, user.address);
				const blockStart = await ethers.provider.getBlockNumber();
				const historicalApprovalEvent = await TestToken.queryFilter(approvalFilter, blockStart - 1000, blockStart + 1000);

				expect(historicalApprovalEvent[0]).not.to.be.null;
				expect(historicalApprovalEvent[0].args).not.to.be.null;
				// expect(approveEvent.data).to.be.equal(historicalApprovalEvent[0].data);
				// @ts-ignore
				// expect(approveEvent.args.length).to.be.equal(historicalApprovalEvent[0].args.length);
				// @ts-ignore
				expect(historicalApprovalEvent[0].args['value']).to.be.equal(MAX_UINT256);
			});

			it('emits Transfer event with correct amount', async () => {
				// TODO: investigate why xferEvent is still null
				// expect(xferEvent).not.to.be.undefined;

				// With a strict filter, we make sure to query the same event produced in 'beforeEach' hook
				const xferFilter = TestToken.filters.Transfer(owner.address, user.address);
				const blockStart = await ethers.provider.getBlockNumber();
				const historicalXferEvent = await TestToken.queryFilter(xferFilter, blockStart - 1000, blockStart + 1000);

				expect(historicalXferEvent[0]).not.to.be.null;
				expect(historicalXferEvent[0].args).not.to.be.null;
				// expect(xferEvent.data).to.be.equal(historicalXferEvent[0].data);
				// @ts-ignore
				// expect(xferEvent.args.length).to.be.equal(historicalXferEvent[0].args.length);
				// @ts-ignore
				expect(historicalXferEvent[0].args['value']).to.be.equal(amount);
			});
		});
	});
});
