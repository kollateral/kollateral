import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { BigNumber, Contract } from 'ethers';
import { ethers } from 'hardhat';

import { expect } from 'chai';
import { ETH_Address } from '../../libs/ethereum';

describe('FlashLoanAggregator', () => {
	let FlashLoanAggregator: Contract;
	let owner: SignerWithAddress;
	let user: SignerWithAddress;
	let feeCollector: SignerWithAddress;

	before(async () => {
		const [addr1, addr2, add3] = await ethers.getSigners();
		owner = addr1;
		user = addr2;
		feeCollector = add3;
	});

	beforeEach(async () => {
		const FlashLoanAggregatorFactory = await ethers.getContractFactory('FlashLoanAggregator');
		FlashLoanAggregator = await FlashLoanAggregatorFactory.connect(owner).deploy(100, feeCollector.address);
		await FlashLoanAggregator.deployed();
	});

	describe('when Aggregator is passed an empty list of pools', () => {
		it('maxFlashLoan should return 0', async () => {
			expect(await FlashLoanAggregator.connect(user).maxFlashLoan(ETH_Address, [])).to.be.equal(0);
		});

		it('flashFee should raise an exception', () => {
			expect(FlashLoanAggregator.connect(user).flashFee(ETH_Address, 1000, [])).to.be.revertedWith(
				'FlashLoanAggregator: Unsupported currency'
			);
		});

		it('flashLoan should raise an exception', () => {
			const dummyCallData = ethers.utils.defaultAbiCoder.encode(['uint256'], [42]);
			expect(FlashLoanAggregator.connect(user).flashLoan(user.address, ETH_Address, 1000, [], dummyCallData)).to.be.revertedWith(
				'FlashLoanAggregator: Liquidity is not sufficient for requested amount'
			);
		});
	});

	describe('when Aggregator is passed a non empty list of pools', () => {
		let TestToken: Contract;
		let Lender: Contract;
		let Borrower: Contract;

		beforeEach(async () => {
			const TestTokenFactory = await ethers.getContractFactory('TestToken');
			TestToken = await TestTokenFactory.connect(owner).deploy('Test Token', 'TT');
			await TestToken.deployed();

			const LenderFactory = await ethers.getContractFactory('LenderWithLiquidity');
			Lender = await LenderFactory.connect(owner).deploy();
			await Lender.deployed();

			const BorrowerFactory = await ethers.getContractFactory('Borrower');
			Borrower = await BorrowerFactory.connect(owner).deploy(FlashLoanAggregator.address);
			await Borrower.deployed();

			const supply = 1000000;
			await TestToken.mint(supply);

			await TestToken.transfer(Lender.address, 10000);
		});

		describe('when aggregator has one available pool', () => {
			it('maxFlashLoan should return max available supply in pool', async () => {
				let aggregatedMax = await FlashLoanAggregator.connect(user).maxFlashLoan(TestToken.address, [Lender.address]);
				let lenderMax = await Lender.connect(user).maxFlashLoan(TestToken.address);

				expect(aggregatedMax).to.be.equal(lenderMax);
			});

			it('flashFee should revert if requested amount is more than available liquidity', async () => {
				let aggregatedMax = await FlashLoanAggregator.connect(user).maxFlashLoan(TestToken.address, [Lender.address]);
				expect(
					FlashLoanAggregator.connect(user).flashFee(TestToken.address, aggregatedMax.add(1), [Lender.address])
				).to.be.revertedWith('FlashLoanAggregator: Liquidity is not sufficient for requested amount');
			});

			it('flashFee should correctly include lender, pool and platform fees', async () => {
				let aggregatedMax = await FlashLoanAggregator.connect(user).maxFlashLoan(TestToken.address, [Lender.address]);
				let fee = await FlashLoanAggregator.connect(user).flashFee(TestToken.address, aggregatedMax, [Lender.address]);

				let lenderFee = await Lender.connect(user).flashFee(TestToken.address, aggregatedMax);
				let platformFee = aggregatedMax.mul(100).div(10000);

				expect(fee).to.be.equal(lenderFee.add(platformFee));
			});
		});

		describe('when aggregator has several available pools but some with no liquidity', () => {
			let LenderWithNoLiquidity: Contract;

			beforeEach(async () => {
				const LenderWithNoLiquidityFactory = await ethers.getContractFactory('LenderWithNoLiquidity');
				LenderWithNoLiquidity = await LenderWithNoLiquidityFactory.connect(owner).deploy();
				await LenderWithNoLiquidity.deployed();
			});

			it('flashFee should ignore lenders with no liquidity', async () => {
				expect(
					FlashLoanAggregator.connect(user).flashFee(TestToken.address, BigNumber.from(100), [
						LenderWithNoLiquidity.address,
						Lender.address,
					])
				).to.not.be.reverted;
			});

			it('flashLoan should succeed and ignore the pool with no liquidity', async () => {
				await TestToken.transfer(Borrower.address, 110);
				await Borrower.borrow(TestToken.address, 10000, [LenderWithNoLiquidity.address, Lender.address]);

				expect(await TestToken.balanceOf(Borrower.address)).to.be.equal(0);
				expect(await TestToken.balanceOf(FlashLoanAggregator.address)).to.be.equal(0);
				expect(await TestToken.balanceOf(feeCollector.address)).to.be.equal(100);
				expect(await TestToken.balanceOf(Lender.address)).to.be.equal(10010);
			});
		});

		describe('when aggregator has several pools with liquidity', () => {
			let Lender2: Contract;

			beforeEach(async () => {
				const LenderWithLiquidityFactory = await ethers.getContractFactory('LenderWithLiquidity');
				Lender2 = await LenderWithLiquidityFactory.connect(owner).deploy();
				await Lender2.deployed();

				await TestToken.transfer(Lender2.address, 10000);
				await TestToken.transfer(Borrower.address, 1000);
			});

			it('onFlashLoan should reject if initiator is not FlashLoanAggregator contract', async () => {
				const dummyCallData = ethers.utils.defaultAbiCoder.encode(['uint256'], [42]);
				expect(FlashLoanAggregator.onFlashLoan(user.address, TestToken.address, 1000, 10, dummyCallData)).to.be.revertedWith(
					'Initiator must be FlashLoanAggregator'
				);
			});

			it('onFlashLoan should reject if lender pool calls with unsupported step id', async () => {
				const LenderWithLiquidityFactory = await ethers.getContractFactory('LenderPropagatingWrongStepParam');
				let Lender3 = await LenderWithLiquidityFactory.connect(owner).deploy();
				await Lender3.deployed();

				await TestToken.transfer(Lender3.address, 1000);

				expect(Borrower.borrow(TestToken.address, 100, [Lender3.address])).to.be.revertedWith('Incorrect flash loan step id');
			});

			it('onFlashLoan should reject if lender pool calls with another pools step id', async () => {
				const LenderWithLiquidityFactory = await ethers.getContractFactory('LenderPropagatingMaliciousStepParam');
				let Lender4 = await LenderWithLiquidityFactory.connect(owner).deploy();
				await Lender4.deployed();

				await TestToken.transfer(Lender4.address, 1000);

				expect(Borrower.borrow(TestToken.address, 100, [Lender4.address, Lender2.address])).to.be.revertedWith(
					'Caller must be the Lender pool'
				);
			});

			it('Flash loan should be sourced with combined liquidity from available pools', async () => {
				await Borrower.borrow(TestToken.address, 15000, [Lender.address, Lender2.address]);

				expect(await TestToken.balanceOf(Borrower.address)).to.be.equal(835);
				expect(await TestToken.balanceOf(FlashLoanAggregator.address)).to.be.equal(0);
				expect(await TestToken.balanceOf(feeCollector.address)).to.be.equal(150);
				expect(await TestToken.balanceOf(Lender.address)).to.be.equal(10010);
				expect(await TestToken.balanceOf(Lender2.address)).to.be.equal(10005);
			});

			it('Successful flash loan should emit FlashLoan event', async () => {
				await expect(await Borrower.borrow(TestToken.address, 15000, [Lender.address, Lender2.address]))
					.to.emit(FlashLoanAggregator, 'FlashLoan')
					.withArgs(Borrower.address, TestToken.address, 15000);
			});
		});
	});
});
