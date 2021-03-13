import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { italic, cyanBright, bold, blueBright, red, yellow } from 'colorette';
import { logDeployResult } from '../../libs/deploy';

export const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	const { deployments, getNamedAccounts } = hre;
	const { deploy, log, execute } = deployments;
	const { deployer, lepidotteri } = await getNamedAccounts();
	const KING = await deployments.get('KING');

	// Deploy Miners.sol contract
	const Miners = await deploy('Miners', {
		from: deployer,
		contract: 'Miners',
		gasLimit: 9500000, // 9,500,000 out of 12,500,000 max gas units
		args: [KING.address, lepidotteri], // assign ownership right away in constructor to avoid timelocks
		skipIfAlreadyDeployed: true,
	});
	logDeployResult(Miners, log);

	// Set KING supply manager to deployed Miners contract
	await execute('KING', { from: deployer }, 'setSupplyManager', Miners.address);
	log(italic(`   - Set Miners contract as KING supply manager (SM)`));
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
	const { deployments } = hre;
	const { log, read } = deployments;

	log(italic(cyanBright(`3] Miners (KING SupplyManager)`)));

	const Miners = await deployments.getOrNull('Miners');
	if (!Miners) {
		return false;
	}

	const SM = await read('KING', 'supplyManager');

	if (SM == Miners.address) {
		log(`   - Skipping, supply manager for KING already set to contract at ${SM}`);
		return true;
	} else {
		return false;
	}
};

export const tags = ['3', 'governance', 'Miners'];
export const dependencies = ['KING'];
export default func;
