import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { cyan, underline, greenBright, italic, magentaBright } from 'colorette';

export const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	const { deployments, getNamedAccounts } = hre;
	const { read, diamond, log } = deployments;
	const { deployer } = await getNamedAccounts();

	log(italic(cyan(`1B) Fake Kingmaker Crown`)));
	await diamond.deploy('FakeCrown', {
		from: deployer,
		facets: ['GovernanceFaucet'],
		log: false,
	});

	const greeting = await read('FakeCrown', { from: deployer }, 'govern', 'The King');
	log(`   - Governance is: ${underline(greenBright(greeting))}`);
};

export const skip: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	const { deployments, getNamedAccounts, ethers } = hre;
	const { log } = deployments;

	// const { deployer } = await getNamedAccounts();
	// const deployerSigner = (await ethers.getSigners())[0];
	// const fakeCrown = await deployments.get("FakeCrown");
	const fakeCrown = {
		contractName: 'FakeCrown',
	};
	const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
	if (ZERO_ADDRESS) {
		// @ts-ignore
		log(`   - Skipping deployment for ${magentaBright(fakeCrown.contractName)}.sol`);
		return true;
	} else {
		return false;
	}
};

export const tags = ['1', 'FakeCrown'];
