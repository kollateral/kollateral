import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { BigNumber, Contract } from 'ethers';
import { ethers } from 'hardhat';

import { expect } from 'chai';
import { ETH_Address } from '../../libs/ethereum';

describe('LendingPoolsAggregator', () => {
	let LendingPoolsAggregator: Contract;
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
		const LendingPoolsAggregatorFactory = await ethers.getContractFactory('LendingPoolsAggregator');
		LendingPoolsAggregator = await LendingPoolsAggregatorFactory.connect(owner).deploy();
		await LendingPoolsAggregator.deployed();
	});

	describe('when Aggregator has no initialized pools', () => {
		it('maxFlashLoan should return 0', async () => {
			expect(await LendingPoolsAggregator.connect(user).maxFlashLoan(ETH_Address)).to.be.equal(0);
		});

		it('flashFee should raise an exception', () => {
			expect(LendingPoolsAggregator.connect(user).flashFee(ETH_Address, 1000)).to.be.revertedWith(
				'LendingPoolsAggregator: Unsupported currency'
			);
		});

		it('flashLoan should raise an exception', () => {
			const dummyCallData = ethers.utils.defaultAbiCoder.encode(['uint256'], [42]);
			expect(LendingPoolsAggregator.connect(user).flashLoan(user.address, ETH_Address, 1000, dummyCallData)).to.be.revertedWith(
				'LendingPoolsAggregator: Liquidity is not sufficient for requested amount'
			);
		});
	});

	describe('when Aggregator has pools', () => {
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
			Borrower = await BorrowerFactory.connect(owner).deploy(LendingPoolsAggregator.address);
			await Borrower.deployed();

			const supply = 1000000;
			await TestToken.mint(supply);

			await TestToken.transfer(Lender.address, 10000);

			await LendingPoolsAggregator.connect(owner).setPlatformFeeBips(100);
			await LendingPoolsAggregator.connect(owner).setPlatformFeeCollectionAddress(feeCollector.address);
		});

		describe('when aggregator has one available pool', () => {
			beforeEach(async () => {
				await LendingPoolsAggregator.connect(owner).setLenders(TestToken.address, [
					{
						pool: Lender.address,
						feeCollectionAddress: feeCollector.address,
						feeBips: 10,
					},
				]);
			});

			it('maxFlashLoan should return max available supply in pool', async () => {
				let aggregatedMax = await LendingPoolsAggregator.connect(user).maxFlashLoan(TestToken.address);
				let lenderMax = await Lender.connect(user).maxFlashLoan(TestToken.address);

				expect(aggregatedMax).to.be.equal(lenderMax);
			});

			it('flashFee should revert if requested amount is more than available liquidity', async () => {
				let aggregatedMax = await LendingPoolsAggregator.connect(user).maxFlashLoan(TestToken.address);
				expect(LendingPoolsAggregator.connect(user).flashFee(TestToken.address, aggregatedMax.add(1))).to.be.revertedWith(
					'LendingPoolsAggregator: Liquidity is not sufficient for requested amount'
				);
			});

			it('flashFee should correctly include lender, pool and platform fees', async () => {
				let aggregatedMax = await LendingPoolsAggregator.connect(user).maxFlashLoan(TestToken.address);
				let fee = await LendingPoolsAggregator.connect(user).flashFee(TestToken.address, aggregatedMax);

				let lenderFee = await Lender.connect(user).flashFee(TestToken.address, aggregatedMax);
				let platformFee = aggregatedMax.mul(100).div(10000);
				let poolFee = aggregatedMax.mul(10).div(10000);

				expect(fee).to.be.equal(lenderFee.add(poolFee).add(platformFee));
			});
		});

		describe('when aggregator has several available pools but some with no liquidity', () => {
			beforeEach(async () => {
				const LenderWithNoLiquidityFactory = await ethers.getContractFactory('LenderWithNoLiquidity');
				let LenderWithNoLiquidity = await LenderWithNoLiquidityFactory.connect(owner).deploy();
				await LenderWithNoLiquidity.deployed();

				await LendingPoolsAggregator.connect(owner).setLenders(TestToken.address, [
					{
						pool: LenderWithNoLiquidity.address,
						feeCollectionAddress: feeCollector.address,
						feeBips: 10,
					},
					{
						pool: Lender.address,
						feeCollectionAddress: feeCollector.address,
						feeBips: 10,
					},
				]);
			});

			it('flashFee should ignore lenders with no liquidity', async () => {
				expect(LendingPoolsAggregator.connect(user).flashFee(TestToken.address, BigNumber.from(100))).to.not.be.reverted;
			});

			it('flashLoan should succeed and ignore the pool with no liquidity', async () => {
				await TestToken.transfer(Borrower.address, 120);
				await Borrower.borrow(TestToken.address, 10000);

				expect(await TestToken.balanceOf(Borrower.address)).to.be.equal(0);
				expect(await TestToken.balanceOf(LendingPoolsAggregator.address)).to.be.equal(0);
				expect(await TestToken.balanceOf(feeCollector.address)).to.be.equal(110);
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

				await LendingPoolsAggregator.connect(owner).setLenders(TestToken.address, [
					{
						pool: Lender.address,
						feeCollectionAddress: feeCollector.address,
						feeBips: 10,
					},
					{
						pool: Lender2.address,
						feeCollectionAddress: feeCollector.address,
						feeBips: 10,
					},
				]);
			});

			it('onFlashLoan should reject if initiator is not LendingPoolAggregator contract', async () => {
				const dummyCallData = ethers.utils.defaultAbiCoder.encode(['uint256'], [42]);
				expect(LendingPoolsAggregator.onFlashLoan(
					user.address,
					TestToken.address,
					1000,
					10,
					dummyCallData
				)).to.be.revertedWith("Initiator must be LendingPoolAggregator");
			});

			it('onFlashLoan should reject if lender pool calls with unsupported step id', async () => {

				const LenderWithLiquidityFactory = await ethers.getContractFactory('LenderPropagatingWrongStepParam');
				let Lender3 = await LenderWithLiquidityFactory.connect(owner).deploy();
				await Lender3.deployed();

				await TestToken.transfer(Lender3.address, 1000);

				await LendingPoolsAggregator.connect(owner).setLenders(TestToken.address, [
					{
						pool: Lender3.address,
						feeCollectionAddress: feeCollector.address,
						feeBips: 10,
					}
				]);

				expect(Borrower.borrow(TestToken.address, 100)).to.be.revertedWith("Incorrect flash loan step id");
			});

			it('onFlashLoan should reject if lender pool calls with another pools step id', async () => {

				const LenderWithLiquidityFactory = await ethers.getContractFactory('LenderPropagatingMaliciousStepParam');
				let Lender4 = await LenderWithLiquidityFactory.connect(owner).deploy();
				await Lender4.deployed();

				await TestToken.transfer(Lender4.address, 1000);

				await LendingPoolsAggregator.connect(owner).setLenders(TestToken.address, [
					{
						pool: Lender4.address,
						feeCollectionAddress: feeCollector.address,
						feeBips: 10,
					},
					{
						pool: Lender2.address,
						feeCollectionAddress: feeCollector.address,
						feeBips: 10,
					}
				]);

				expect(Borrower.borrow(TestToken.address, 100)).to.be.revertedWith("Caller must be the Lender pool");
			});

			it('Flash loan should be sourced with combined liquidity from available pools', async () => {
				await Borrower.borrow(TestToken.address, 15000);

				expect(await TestToken.balanceOf(Borrower.address)).to.be.equal(820);
				expect(await TestToken.balanceOf(LendingPoolsAggregator.address)).to.be.equal(0);
				expect(await TestToken.balanceOf(feeCollector.address)).to.be.equal(165);
				expect(await TestToken.balanceOf(Lender.address)).to.be.equal(10010);
				expect(await TestToken.balanceOf(Lender2.address)).to.be.equal(10005);
			});
		});
	});
});
