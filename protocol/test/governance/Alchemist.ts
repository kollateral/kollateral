import { Contract } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import { expect } from 'chai';
import { ethers } from 'hardhat';

import { rewards } from '../fixtures';
import { getEnv } from '../../libs/config';
import { INITIAL_KING_LIQUIDITY } from '../../libs/deploy';
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

	beforeEach(async function () {
		const f = await rewards();
		govToken = f.govToken;
		deployer = f.deployer;
		treasurer = f.treasurer;
		lepidotteri = f.lepidotteri;
		SHA_2048 = f.SHA_2048;
		Peasant = f.Peasant;

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
		await Alchemist.connect(treasurer).depositReserve(INITIAL_KING_LIQUIDITY);
		await NC_Alchemist.connect(treasurer).depositReserve(INITIAL_KING_LIQUIDITY);
	});

	context('depositReserve', async () => {
		it('emitted ReserveDeposited event with correct args', async () => {
			const { timestamp } = await ethers.provider.getBlock('latest');
			let topic = ethers.utils.id('ReserveDeposited(uint256,uint256)');
			let filter = {
				address: Alchemist.address,
				fromBlock: timestamp - 1000,
				toBlock: 'latest',
				topics: [topic],
			};
			// basic filtering can't even fetch indexed parameters apparently
			// const depositEvent = await Alchemist.filters.ReserveDeposited(null, null);
			const depositEvent = (await Alchemist.queryFilter(filter))[0];
			expect(depositEvent).to.exist;
			expect(depositEvent.topics.length).to.eq(3);
		});

		it('transmutable reserve to be half the deposited reserve', async () => {
			const transmutableReserve = await Alchemist.transmutableReserve();

			await expect(transmutableReserve).to.eq(ethers.BigNumber.from(INITIAL_KING_LIQUIDITY).div(2));
		});

		it('does not allow to replenish token reserves', async () => {
			await expect(Alchemist.connect(treasurer).depositReserve(INITIAL_KING_LIQUIDITY)).to.be.revertedWith(
				'Alchemist::transmute: Reserve was already deposited'
			);
		});

		it('does not allow to add token reserve after IBCO end date', async () => {
			const endTime = await Alchemist.callStatic.end();

			await ethers.provider.send('evm_setNextBlockTimestamp', [parseInt(endTime) + 1]);
			await ethers.provider.send('evm_mine', []);

			await expect(Alchemist.connect(treasurer).depositReserve(INITIAL_KING_LIQUIDITY)).to.be.revertedWith(
				'Alchemist::depositReserve: Deposit unavailable at the end'
			);
		});

		it('does not allow non-owner to deposit token reserves', async () => {
			await expect(Alchemist.connect(SHA_2048).depositReserve(INITIAL_KING_LIQUIDITY)).to.be.revertedWith(
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

		it('non-competitive IBCO returns a flat distribution for a transmuted reserve', async () => {
			await NC_Alchemist.connect(Peasant).transmute({ value: ethers.utils.parseEther('1.0') });
			const transmutedReserve = await govToken.balanceOf(Peasant.address);
			console.log("NC_Alchemist 1st transmutation:", transmutedReserve.toString());

			expect(transmutedReserve).to.exist;
		});

		it('non-competitive IBCO returns a flat distribution for each transmuted reserve', async () => {
			await NC_Alchemist.connect(Peasant).transmute({ value: ethers.utils.parseEther('1.0') });
			const transmutedReserve1 = await govToken.balanceOf(Peasant.address);
			console.log("NC_Alchemist 1st transmutation:", transmutedReserve1.toString());

			await NC_Alchemist.connect(Peasant).transmute({ value: ethers.utils.parseEther('10.0') });
			const transmutedReserve2 = await govToken.balanceOf(Peasant.address);
			console.log("NC_Alchemist 2nd transmutation:", transmutedReserve2.toString());

			await NC_Alchemist.connect(Peasant).transmute({ value: ethers.utils.parseEther('1.0') });
			const transmutedReserve3 = await govToken.balanceOf(Peasant.address);
			console.log("NC_Alchemist 3rd transmutation:", transmutedReserve3.toString());

			expect(transmutedReserve1).to.exist;
			expect(transmutedReserve2).to.exist;
			expect(transmutedReserve3).to.exist;
		});

		xit('competitive IBCO returns transmuted reserve', async () => {
			await Alchemist.connect(Peasant).transmute({ value: ethers.utils.parseEther('10.0') });
			const transmutedReserve = await govToken.balanceOf(Peasant.address);
			console.log(transmutedReserve.toString());

			expect(transmutedReserve).to.exist;
		});
	});
});
