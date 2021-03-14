import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { BigNumber, Contract } from 'ethers';
import { ethers } from 'hardhat';

import { expect } from 'chai';

const DUMMY_ADDRESS = '0x0000000000000000000000000000000000000002';

describe('LendingPool', () => {
	let LendingPoolsAggregator: Contract;
	let owner: SignerWithAddress;
	let user: SignerWithAddress;

	before(async () => {
		const [addr1, addr2] = await ethers.getSigners();
		owner = addr1;
		user = addr2;
	});

	beforeEach(async () => {
		const LendingPoolsAggregatorFactory = await ethers.getContractFactory('LendingPool');
		LendingPoolsAggregator = await LendingPoolsAggregatorFactory.connect(owner).deploy();
		await LendingPoolsAggregator.deployed();
	});

	describe('when LendingPool has no initialized pools', () => {
		it('getPlatformFeeBips should return 0', async () => {
			expect(await LendingPoolsAggregator.connect(user).getPlatformFeeBips()).to.be.equal(0);
		});

		it('getPlatformFeeCollectionAddress should return 0x address', async () => {
			expect(await LendingPoolsAggregator.connect(user).getPlatformFeeCollectionAddress()).to.be.equal(
				'0x0000000000000000000000000000000000000000'
			);
		});

		it('getLenders should return an empty array', async () => {
			expect(await LendingPoolsAggregator.connect(user).getLenders(DUMMY_ADDRESS)).to.be.empty;
		});
	});

	describe('when setting LendingPool parameters', () => {
		it('setPlatformFeeBips cannot be called by non owner address', () => {
			expect(LendingPoolsAggregator.connect(user).setPlatformFeeBips(100)).to.be.revertedWith('Ownable: caller is not the owner');
		});

		it('setPlatformFeeCollectionAddress cannot be called by non owner address', () => {
			expect(LendingPoolsAggregator.connect(user).setPlatformFeeCollectionAddress(DUMMY_ADDRESS)).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);
		});

		it('setLenders cannot be called by non owner address', () => {
			expect(LendingPoolsAggregator.connect(user).setLenders(DUMMY_ADDRESS, [])).to.be.revertedWith('Ownable: caller is not the owner');
		});

		it('setPlatformFeeBips succeeds when called by owner', async () => {
			await LendingPoolsAggregator.connect(owner).setPlatformFeeBips(100);
			expect(await LendingPoolsAggregator.connect(user).getPlatformFeeBips()).to.be.equal(100);
		});

		it('setPlatformFeeCollectionAddress succeeds when called by owner', async () => {
			await LendingPoolsAggregator.connect(owner).setPlatformFeeCollectionAddress(DUMMY_ADDRESS);
			expect(await LendingPoolsAggregator.connect(user).getPlatformFeeCollectionAddress()).to.be.equal(DUMMY_ADDRESS);
		});

		it('setLenders succeeds when passing well-formed data', async () => {
			let lender = {
				pool: DUMMY_ADDRESS,
				feeCollectionAddress: DUMMY_ADDRESS.replace('2', '3'),
				feeBips: 10,
			};
			await LendingPoolsAggregator.connect(owner).setLenders(DUMMY_ADDRESS, [lender]);
			let storedLender = await LendingPoolsAggregator.connect(user).getLenders(DUMMY_ADDRESS);

			expect(storedLender[0][0]).to.be.equal(lender.pool);
			expect(storedLender[0][1]).to.be.equal(lender.feeCollectionAddress);
			expect(storedLender[0][2]).to.be.equal(BigNumber.from(lender.feeBips));
		});

		it('setLenders should always override previous list', async () => {
			let previousLender = {
				pool: DUMMY_ADDRESS,
				feeCollectionAddress: DUMMY_ADDRESS.replace('2', '3'),
				feeBips: 10,
			};
			await LendingPoolsAggregator.connect(owner).setLenders(DUMMY_ADDRESS, [previousLender]);

			let currentLender = {
				pool: DUMMY_ADDRESS.replace('2', '4'),
				feeCollectionAddress: DUMMY_ADDRESS.replace('2', '5'),
				feeBips: 100,
			};
			await LendingPoolsAggregator.connect(owner).setLenders(DUMMY_ADDRESS, [currentLender]);
			let storedLender = await LendingPoolsAggregator.connect(user).getLenders(DUMMY_ADDRESS);

			expect(storedLender[0][0]).to.be.equal(currentLender.pool);
			expect(storedLender[0][1]).to.be.equal(currentLender.feeCollectionAddress);
			expect(storedLender[0][2]).to.be.equal(BigNumber.from(currentLender.feeBips));
		});
	});
});
