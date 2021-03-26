import { Contract } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import IUniswapV2ERC20 from '@uniswap/v2-core/build/IUniswapV2ERC20.json'

import { expect } from 'chai';
import { ethers } from 'hardhat';

import { rewards } from '../fixtures';
import { getEnv } from '../../libs/config';
import { INITIAL_KING_LIQUIDITY, INITIAL_KING_OFFERING } from '../../libs/deploy';
import {moveAtTimestamp, to10Pow18} from '../../libs/ethereum';
import { day } from '../../libs/time';
import {WETH10_ADDRESS} from "../../libs/liquidity/weth";
import {UNI_V2_FACTORY_ABI, UNI_V2_FACTORY_ADDRESS, UNI_V2_PAIR_ABI} from "../../libs/liquidity/uniswap";

const KINGMAKER_DEPLOYER_PK = getEnv('KINGMAKER_DEPLOYER_PK') || '0x';

describe('Alchemist', () => {
	let KING: Contract;
	let Alchemist: Contract;

	let deployer: SignerWithAddress;
	let treasurer: SignerWithAddress;
	let lepidotteri: SignerWithAddress;
	let SHA_2048: SignerWithAddress;
	let Peasant: SignerWithAddress;
	let King: SignerWithAddress;
	let Jester: SignerWithAddress;

	beforeEach(async function () {
		const f = await rewards();
		KING = f.govToken;
		deployer = f.deployer;
		treasurer = f.treasurer;
		lepidotteri = f.lepidotteri;
		SHA_2048 = f.SHA_2048;
		Peasant = f.Peasant;
		King = f.King;
		Jester = f.Jester;

		const alchemistFactory = await ethers.getContractFactory('Alchemist');
		Alchemist = await alchemistFactory.deploy(KING.address, ethers.utils.parseEther('0.9'));

		// Transfer of ownership
		await Alchemist.connect(deployer).changeTreasury(treasurer.address);

		// Pre-authorize Alchemist contracts to transfer reserves on behalf of treasury
		await KING.connect(treasurer).approve(Alchemist.address, ethers.constants.MaxUint256);

		// Provide initial KING liquidity
		await Alchemist.connect(treasurer).depositReserve(INITIAL_KING_OFFERING, INITIAL_KING_LIQUIDITY);
	});

	context('depositReserve', async () => {
		it('emitted ReservesDeposited event with correct args', async () => {
			const { timestamp } = await ethers.provider.getBlock('latest');
			const topic = ethers.utils.id('ReservesDeposited(uint256,uint256)');
			const filter = {
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
				'Alchemist::onlyTreasury: not treasury'
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

		it('IBCO does not accept too low an offering in transmutation', async () => {
			await expect(Alchemist.connect(Peasant).transmute({ value: ethers.utils.parseEther('0.88888888') })).to.be.revertedWith(
				'Alchemist::transmute: more ETH ingredient needed'
			);
		});

		it('IBCO returns a correct distribution for a successful transmutation', async () => {
			await Alchemist.connect(Peasant).transmute({ value: ethers.utils.parseEther('0.9') });
			const transmutedReserve = await KING.balanceOf(Peasant.address);

			expect(transmutedReserve).to.exist;
		});

		it('IBCO returns a correct distribution for each successful transmutation', async () => {
			await Alchemist.connect(Peasant).transmute({ value: ethers.utils.parseEther('1') });
			const transmutedReserve1 = await KING.balanceOf(Peasant.address);
			await Alchemist.connect(SHA_2048).transmute({ value: ethers.utils.parseEther('10.1') });
			const transmutedReserve2 = await KING.balanceOf(SHA_2048.address);
			await Alchemist.connect(lepidotteri).transmute({ value: ethers.utils.parseEther('100.01') });
			const transmutedReserve3 = await KING.balanceOf(lepidotteri.address);
			await Alchemist.connect(King).transmute({ value: ethers.utils.parseEther('1000.01') });
			const transmutedReserve4 = await KING.balanceOf(King.address);

			expect(transmutedReserve1).to.exist;
			expect(transmutedReserve2).to.exist;
			expect(transmutedReserve3).to.exist;
			expect(transmutedReserve4).to.exist;
		});

		it('IBCO should revert if running out of transmutable reserve (whale purchase)', async () => {
			await expect(Alchemist.connect(King).transmute({ value: ethers.utils.parseEther('100000.000') })).to.be.reverted;
		});
	});

	context('distillate', async () => {
		it('Treasury cannot distillate before end of IBCO', async () => {
			await expect(Alchemist.connect(treasurer).distillate()).to.be.revertedWith(
				'Alchemist::distillate: Distillation unavailable yet'
			);
		});

		it('Non-treasury cannot distillate', async () => {
			const now = parseInt(String(Date.now() / 1000));
			await moveAtTimestamp(now + 10 * day);

			await expect(Alchemist.connect(Peasant).distillate()).to.be.reverted;
		});

		it('Treasury should hold UNI_V2_LP tokens after successful distillation', async () => {
			// emulate IBCO proceedings
			await Alchemist.connect(lepidotteri).transmute({ value: ethers.utils.parseEther('101') });

			const now = parseInt(String(Date.now() / 1000));
			await moveAtTimestamp(now + 10 * day);

			await Alchemist.connect(treasurer).distillate();

			const UNI_V2_Factory = new ethers.Contract(UNI_V2_FACTORY_ADDRESS, UNI_V2_FACTORY_ABI, treasurer);
			const UNI_V2_PAIR_ADDRESS = await UNI_V2_Factory.getPair(WETH10_ADDRESS, KING.address);
			const UNI_V2_PAIR = new ethers.Contract(UNI_V2_PAIR_ADDRESS, UNI_V2_PAIR_ABI, treasurer);

			const treasuryLPBalance = await UNI_V2_PAIR.balanceOf(treasurer.address);
			expect(treasuryLPBalance).to.exist;
		});
	});

	context('withdrawReserve', async () => {
		it('Treasury cannot withdraw reserve before end of IBCO', async () => {
			await expect(Alchemist.connect(treasurer).withdrawReserve()).to.be.revertedWith(
				'Alchemist::withdrawReserve: Withdrawal unavailable yet'
			);
		});

		it('Treasury cannot withdraw reserve before distillation', async () => {
			const now = parseInt(String(Date.now() / 1000));
			await moveAtTimestamp(now + 10 * day);

			await expect(Alchemist.connect(treasurer).withdrawReserve()).to.be.revertedWith(
				'Alchemist::withdrawReserve: distillation must be completed first'
			);
		});
	});
});
