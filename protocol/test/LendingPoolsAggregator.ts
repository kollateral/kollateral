import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { Contract } from 'ethers';
import { ethers } from 'hardhat';

import { assert, expect } from 'chai';

const ETHER_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000001';

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

		it('maxFlashLoan should return 0', async () => {
			const maxAvailableLoan = await LendingPoolsAggregator.connect(user).maxFlashLoan(ETHER_TOKEN_ADDRESS);
			expect(maxAvailableLoan).to.be.equal(0);
		});

		it('flashFee should raise an exception', async () => {
			try {
				await LendingPoolsAggregator.connect(user).flashFee(ETHER_TOKEN_ADDRESS, 1000)
				assert(false, "Should have failed");
			} catch (e) {
				expect(e.message === "LendingPoolsAggregator: Unsupported currency");
			}
		});

		it('flashLoan should raise an exception', async () => {
			const dummyCallData = ethers.utils.defaultAbiCoder.encode(['uint256'], [42]);
			try {
				await LendingPoolsAggregator.connect(user).flashLoan(
					user.address,
					ETHER_TOKEN_ADDRESS,
					1000,
					dummyCallData
				);
				assert(false, "Should have failed");
			} catch (e) {
				expect(e.message === "LendingPoolsAggregator: Unsupported currency");
			}
		});
	});
});
