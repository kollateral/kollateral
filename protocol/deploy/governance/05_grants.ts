import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import {italic, cyanBright, magenta} from 'colorette';

import { addGrants } from '../../libs/grants/utils';

export const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	const { deployments, getNamedAccounts } = hre;
	const { log, execute } = deployments;
	const { deployer, lepidotteri } = await getNamedAccounts();

	// Set start time for grants at now + 48 hours
	// const delay = 48 * 60 * 60
	// e.g. const startTime = parseInt(Date.now() / 1000) + delay
	await addGrants(0);
	log(`   - All grants have been distributed per instructions`);

	// Handed vesting contract administration to lepidotteri
	await execute('Monastery', { from: deployer }, 'changeClergy', lepidotteri);
	log(italic(`   - Handed vesting contract admin to ${magenta(lepidotteri)}`));
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
	const { deployments } = hre;
	const { log } = deployments;
	log(italic(cyanBright(`5] Grants`)));
	return false;
};

export const tags = ['5', 'governance', 'Grants'];
export const dependencies = ['Monastery'];
export default func;
