import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {Contract} from 'ethers';
import { ethers } from 'hardhat';

import { expect } from 'chai';
import {ETH_Address} from "../../libs/ethereum";

describe('LendingPoolsAggregator', () => {
	let LendingPoolsAggregator: Contract;
	let owner: SignerWithAddress;
	let user: SignerWithAddress;

	before(async () => {
		const [addr1, addr2] = await ethers.getSigners();
		owner = addr1;
		user = addr2;
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

});
