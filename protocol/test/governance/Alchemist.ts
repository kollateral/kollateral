import { Contract } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import { expect } from 'chai';
import { ethers } from 'hardhat';

import { rewards } from '../fixtures';
import { getEnv } from '../../libs/config';
import {INITIAL_KING_LIQUIDITY, INITIAL_KING_OFFERING} from '../../libs/deploy';
import { to10Pow18 } from '../../libs/ethereum';

const KINGMAKER_DEPLOYER_PK = getEnv('KINGMAKER_DEPLOYER_PK') || '0x';

describe('Alchemist', () => {
	let govToken: Contract;
	let Alchemist: Contract;
	let NC_Alchemist: Contract;

	let deployer: SignerWithAddress;
	let treasurer: SignerWithAddress;
	let lepidotteri: SignerWithAddress;
	let SHA_2048: SignerWithAddress;
	let Peasant: SignerWithAddress;
	let King: SignerWithAddress;
	let Jester: SignerWithAddress;

	beforeEach(async function () {
		const f = await rewards();
		govToken = f.govToken;
		deployer = f.deployer;
		treasurer = f.treasurer;
		lepidotteri = f.lepidotteri;
		SHA_2048 = f.SHA_2048;
		Peasant = f.Peasant;
		King = f.King;
		Jester = f.Jester;

		const alchemistFactory = await ethers.getContractFactory('Alchemist');
		Alchemist = await alchemistFactory.deploy(govToken.address, ethers.utils.parseEther('0.9'), true);
		NC_Alchemist = await alchemistFactory.deploy(govToken.address, ethers.utils.parseEther('0.9'), false);

		// Change of clergy
		await Alchemist.connect(deployer).conversion(treasurer.address);
		await NC_Alchemist.connect(deployer).conversion(treasurer.address);

		// Pre-authorize Alchemist contracts to transfer reserves on behalf of treasury
		await govToken.connect(treasurer).approve(Alchemist.address, ethers.constants.MaxUint256);
		await govToken.connect(treasurer).approve(NC_Alchemist.address, ethers.constants.MaxUint256);

		// Provide initial ingredient (KING liquidity) to both IBCO variants
		await Alchemist.connect(treasurer).depositReserve(INITIAL_KING_OFFERING, INITIAL_KING_LIQUIDITY);
		await NC_Alchemist.connect(treasurer).depositReserve(INITIAL_KING_OFFERING, INITIAL_KING_LIQUIDITY);
	});

	context('depositReserve', async () => {
		it('emitted ReservesDeposited event with correct args', async () => {
			const { timestamp } = await ethers.provider.getBlock('latest');
			let topic = ethers.utils.id('ReservesDeposited(uint256,uint256)');
			let filter = {
				address: Alchemist.address,
				fromBlock: timestamp - 1000,
				toBlock: 'latest',
				topics: [topic],
			};
			// basic filtering can't even fetch indexed parameters apparently
			// const depositEvent = await Alchemist.filters.ReservesDeposited(null, null);
			const depositEvent = (await Alchemist.queryFilter(filter))[0];
			expect(depositEvent).to.exist;
			expect(depositEvent.topics.length).to.eq(3);
		});

		it('transmutable reserve to be equal the offering reserve', async () => {
			const transmutableReserve = await Alchemist.transmutableReserve();

			await expect(transmutableReserve).to.eq(ethers.BigNumber.from(INITIAL_KING_OFFERING));
		});

		it('does not allow to replenish token reserves', async () => {
			await expect(Alchemist.connect(treasurer).depositReserve(INITIAL_KING_OFFERING, INITIAL_KING_LIQUIDITY)).to.be.revertedWith(
				'Alchemist::transmute: Reserve was already deposited'
			);
		});

		it('does not allow non-owner to deposit token reserves', async () => {
			await expect(Alchemist.connect(SHA_2048).depositReserve(INITIAL_KING_OFFERING, INITIAL_KING_LIQUIDITY)).to.be.revertedWith(
				'Alchemist::onlyChurch: not clergy'
			);
		});
	});

	context('transmute', async () => {
		it('values below transmutation threshold are refused', async () => {
			await expect(Alchemist.connect(Peasant).transmute({ value: ethers.utils.parseEther('0.1') })).to.be.revertedWith(
				'Alchemist::transmute: more ETH ingredient'
			);
		});

		it('does not allow transmutations after IBCO end date', async () => {
			const endTime = await Alchemist.callStatic.end();

			await ethers.provider.send('evm_setNextBlockTimestamp', [parseInt(endTime) + 1]);
			await ethers.provider.send('evm_mine', []);

			await expect(Alchemist.connect(Peasant).transmute({ value: ethers.utils.parseEther('1.0') })).to.be.revertedWith(
				'Alchemist::transmute: The offering has ended'
			);
		});

		it('non-competitive IBCO does not accept too low an offering in transmutation', async () => {
			await expect(NC_Alchemist.connect(Peasant).transmute({ value: ethers.utils.parseEther('0.88888888') })).to.be.revertedWith(
				'Alchemist::transmute: more ETH ingredient needed'
			);
		});

		it('non-competitive IBCO returns a correct distribution for a successful transmutation', async () => {
			await NC_Alchemist.connect(Peasant).transmute({ value: ethers.utils.parseEther('0.9') });
			const transmutedReserve = await govToken.balanceOf(Peasant.address);

			expect(transmutedReserve).to.exist;
		});

		it('non-competitive IBCO returns a flat distribution for each transmuted reserve', async () => {
			await NC_Alchemist.connect(Peasant).transmute({ value: ethers.utils.parseEther('1') });
			const transmutedReserve1 = await govToken.balanceOf(Peasant.address);
			await NC_Alchemist.connect(SHA_2048).transmute({ value: ethers.utils.parseEther('10.1') });
			const transmutedReserve2 = await govToken.balanceOf(SHA_2048.address);
			await NC_Alchemist.connect(lepidotteri).transmute({ value: ethers.utils.parseEther('1000.01') });
			const transmutedReserve3 = await govToken.balanceOf(lepidotteri.address);

			expect(transmutedReserve1).to.exist;
			expect(transmutedReserve2).to.exist;
			expect(transmutedReserve3).to.exist;
		});

		it('non-competitive IBCO should revert if running out of transmutable reserve (whale purchase)', async () => {
			await expect(NC_Alchemist.connect(King).transmute({ value: ethers.utils.parseEther('100000.000') })).to.be.reverted;
		});

		it('competitive IBCO returns transmuted reserve', async () => {
			await Alchemist.connect(Peasant).transmute({ value: ethers.utils.parseEther('1.0') });
			const transmutedReserve = await govToken.balanceOf(Peasant.address);
			await Alchemist.connect(Jester).transmute({ value: ethers.utils.parseEther('1.0') });
			const transmutedReserve2 = await govToken.balanceOf(Jester.address);

			expect(transmutedReserve).to.exist;
			expect(transmutedReserve2).to.exist;
		});
	});
});
