import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { italic, cyanBright, bold, blueBright, red, yellow } from 'colorette';
import { logDeployResult } from '../../libs/deploy';

export const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	const { deployments, getNamedAccounts } = hre;
	const { deploy, log, execute } = deployments;
	const { deployer, lepidotteri } = await getNamedAccounts();
	const KING = await deployments.get('KING');

	log(italic(cyanBright(`   6] Multisend`)));

	// Deploy Miners.sol contract
	const Multisend = await deploy('Multisend', {
		from: deployer,
		contract: 'Multisend',
		gasLimit: 9500000, // 9,500,000 out of 12,500,000 max gas units
		args: [KING.address],
		skipIfAlreadyDeployed: true,
	});
	logDeployResult(Multisend, log);

};

export const tags = ['6', 'governance', 'Multisend'];
export const dependencies = ['KING'];
export default func;
