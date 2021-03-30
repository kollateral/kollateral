import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { Contract } from 'ethers';
import { ethers } from 'hardhat';

import { expect } from 'chai';

const FEE_COLLECTION_ADDRESS = '0x0000000000000000000000000000000000000002';
const FEE_COLLECTION_ADDRESS_NEW = '0x0000000000000000000000000000000000000003';

describe('PlatformFeesManager', () => {
	let PlatformFeesManagerAggregator: Contract;
	let owner: SignerWithAddress;
	let user: SignerWithAddress;

	before(async () => {
		const [addr1, addr2] = await ethers.getSigners();
		owner = addr1;
		user = addr2;
	});

	beforeEach(async () => {
		const PlatformFeesManagerAggregatorFactory = await ethers.getContractFactory('PlatformFeesManager');

		PlatformFeesManagerAggregator = await PlatformFeesManagerAggregatorFactory.connect(owner).deploy(100, FEE_COLLECTION_ADDRESS);

		await PlatformFeesManagerAggregator.deployed();
	});

	it('getPlatformFeeBips should return 100', async () => {
		expect(await PlatformFeesManagerAggregator.connect(user).getPlatformFeeBips()).to.be.equal(100);
	});

	it('getPlatformFeeCollectionAddress should return correct address', async () => {
		expect(await PlatformFeesManagerAggregator.connect(user).getPlatformFeeCollectionAddress()).to.be.equal(FEE_COLLECTION_ADDRESS);
	});

	it('calculatePlatformFee should return correct fee applied to amount param', async () => {
		expect(await PlatformFeesManagerAggregator.connect(user).calculatePlatformFee(10000)).to.be.equal(100);
	});

	it('setPlatformFeeBips cannot be called by non owner address', () => {
		expect(PlatformFeesManagerAggregator.connect(user).setPlatformFeeBips(100)).to.be.revertedWith('Ownable: caller is not the owner');
	});

	it('setPlatformFeeCollectionAddress cannot be called by non owner address', () => {
		expect(PlatformFeesManagerAggregator.connect(user).setPlatformFeeCollectionAddress(FEE_COLLECTION_ADDRESS_NEW)).to.be.revertedWith(
			'Ownable: caller is not the owner'
		);
	});

	it('setPlatformFeeBips succeeds when called by owner', async () => {
		await PlatformFeesManagerAggregator.connect(owner).setPlatformFeeBips(100);
		expect(await PlatformFeesManagerAggregator.connect(user).getPlatformFeeBips()).to.be.equal(100);
	});

	it('setPlatformFeeCollectionAddress succeeds when called by owner', async () => {
		await PlatformFeesManagerAggregator.connect(owner).setPlatformFeeCollectionAddress(FEE_COLLECTION_ADDRESS_NEW);
		expect(await PlatformFeesManagerAggregator.connect(user).getPlatformFeeCollectionAddress()).to.be.equal(FEE_COLLECTION_ADDRESS_NEW);
	});
});
