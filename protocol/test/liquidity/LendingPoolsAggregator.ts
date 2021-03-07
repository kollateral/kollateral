import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {BigNumber, Contract} from 'ethers';
import { ethers } from 'hardhat';

import { expect } from 'chai';
import {ETH_Address} from "../../libs/ethereum";

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

		it('maxFlashLoan should return 0',   async () => {
			expect(await LendingPoolsAggregator.connect(user).maxFlashLoan(ETH_Address))
				.to.be.equal(0);
		});

		it('flashFee should raise an exception', () => {
			expect(LendingPoolsAggregator.connect(user).flashFee(ETH_Address, 1000))
				.to.be.revertedWith("LendingPoolsAggregator: Unsupported currency");
		});

		it('flashLoan should raise an exception',  () => {
			const dummyCallData = ethers.utils.defaultAbiCoder.encode(['uint256'], [42]);
			expect(
				LendingPoolsAggregator.connect(user).flashLoan(
					user.address,
					ETH_Address,
					1000,
					dummyCallData
				)
			).to.be.revertedWith("LendingPoolsAggregator: Liquidity is not sufficient for requested amount");
		});

	});

	describe("when aggregator has one available pool", () => {

		let WETH10: Contract;

		beforeEach(async () => {
			const WETH10Factory = await ethers.getContractFactory('WETH10');
			WETH10 = await WETH10Factory.connect(owner).deploy();
			await WETH10.deployed();

			await LendingPoolsAggregator.connect(owner).setPlatformFeeBips(100);
			await LendingPoolsAggregator.connect(owner).setPlatformFeeCollectionAddress(feeCollector.address);

			await LendingPoolsAggregator.connect(owner).setLenders(
				WETH10.address,
				[
					{
						_address: WETH10.address,
						_feeCollectionAddress: feeCollector.address,
						_feeBips: 10
					}
				]
			)
		});

		it('maxFlashLoan should return max available supply in pool', async () => {

			let aggregatedMax = await LendingPoolsAggregator.connect(user).maxFlashLoan(WETH10.address);
			let wethPoolMax = await WETH10.connect(user).maxFlashLoan(WETH10.address);

			expect(aggregatedMax).to.be.equal(wethPoolMax);
		});

		it('flashFee should correctly include lender, pool and platform fees', async () => {

			let aggregatedMax = await LendingPoolsAggregator.connect(user).maxFlashLoan(WETH10.address);
			let fee = await LendingPoolsAggregator.connect(user).flashFee(WETH10.address, aggregatedMax);

			let wethFee = await WETH10.connect(user).flashFee(WETH10.address, aggregatedMax);
			let platformFee = aggregatedMax.mul(100).div(10000);
			let poolFee = aggregatedMax.mul(10).div(10000);

			expect(fee).to.be.equal(wethFee.add(poolFee).add(platformFee));
		});

	});

});
