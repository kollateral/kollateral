import { Contract } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import { expect } from 'chai';
import { ethers } from 'hardhat';

import { rewards } from '../fixtures';
import { getEnv } from '../../libs/config';
import {INITIAL_KING_LIQUIDITY} from "../../libs/deploy";

const KINGMAKER_DEPLOYER_PK = getEnv('KINGMAKER_DEPLOYER_PK') || '0x';

describe('Alchemist', () => {
	let govToken: Contract;
	let Alchemist: Contract;
	let NC_Alchemist: Contract;

	let deployer: SignerWithAddress;
	let lepidotteri: SignerWithAddress;
	let SHA_2048: SignerWithAddress;

	beforeEach(async function () {
		const f = await rewards();
		govToken = f.govToken;
		deployer = f.deployer;
		lepidotteri = f.lepidotteri;
		SHA_2048 = f.SHA_2048;

		const alchemistFactory = await ethers.getContractFactory('Alchemist');
		Alchemist = await alchemistFactory.deploy(govToken.address, ethers.utils.parseEther('0.9'), true);
		NC_Alchemist = await alchemistFactory.deploy(govToken.address, ethers.utils.parseEther('0.9'), false);
		await govToken.approve(deployer.address, ethers.constants.MaxUint256);

		await Alchemist.connect(deployer).depositReserve(INITIAL_KING_LIQUIDITY);
		await NC_Alchemist.connect(deployer).depositReserve(INITIAL_KING_LIQUIDITY);
	});

	context('lockTokens', async () => {
		it('creates valid lock of KING tokens', async () => {
			
		});
	});
});
