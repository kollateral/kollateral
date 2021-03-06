import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { Contract } from 'ethers';
import { ethers } from 'hardhat';

import { expect } from 'chai';
import {ETH_Address} from "../../libs/ethereum";

const DUMMY_ADDRESS = '0x0000000000000000000000000000000000000002';
const DUMMY_CALL_DATA = '0x6c00000000000000000000000000000000000000000000000000000000000000';

describe('LendingPoolsAggregator', () => {
	let LendingPoolsAggregator: Contract;
	let owner: SignerWithAddress;
	let user: SignerWithAddress;

	describe('when Aggregator has no initialized pools', () => {

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

		it('setPlatformFeeBips cannot be called by non owner address',  () => {
			expect(LendingPoolsAggregator.connect(user).setPlatformFeeBips(100))
				.to.be
				.revertedWith("Ownable: caller is not the owner");
		});

		it('setPlatformFeeCollectionAddress cannot be called by non owner address',  () => {
			expect(LendingPoolsAggregator.connect(user).setPlatformFeeCollectionAddress(DUMMY_ADDRESS))
				.to.be
				.revertedWith("Ownable: caller is not the owner");
		});

		it('setLenders cannot be called by non owner address',  () => {
			expect(LendingPoolsAggregator.connect(user).setLenders(DUMMY_ADDRESS, DUMMY_CALL_DATA))
				.to.be
				.revertedWith("Ownable: caller is not the owner");
		});
	});
});
