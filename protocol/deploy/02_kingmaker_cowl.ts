import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { underline, greenBright, italic, magenta, cyanBright } from 'colorette';

const skip: DeployFunction = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
	const { deployments, getNamedAccounts, ethers } = hre;
	const { log } = deployments;
	const { deployer } = await getNamedAccounts();
	const deployerSigner = (await ethers.getSigners())[0];
	// const deployedCowl = await deployments.get("Cowl");
	const cowl = {
		contractName: 'Cowl',
	};
	const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
	if (ZERO_ADDRESS) {
		// @ts-ignore
		log(`   - Skipping deployment for ${magenta(cowl.contractName)}.sol`);
		return true;
	} else {
		return false;
	}
};

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	const { deployments, getNamedAccounts } = hre;
	const { read, diamond, log } = deployments;
	const { deployer } = await getNamedAccounts();

	log(italic(cyanBright(`2) Kingmaker Cowl`)));

	await diamond.deploy('Cowl', {
		from: deployer,
		facets: ['CrownGovernanceFacet'],
		log: false,
	});

	const greeting = await read('Cowl', { from: deployer }, 'govern', 'The King');
	log(`   - Governance is: ${underline(greenBright(greeting))}`);
};

export default func;
export const tags = ['1', 'Cowl'];
