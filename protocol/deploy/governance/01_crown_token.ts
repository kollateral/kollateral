import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { italic, cyanBright } from 'colorette';
import { logDeployResult } from '../../libs/deploy';

export const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	const { deployments, getNamedAccounts } = hre;
	const { deploy, log } = deployments;
	const { deployer } = await getNamedAccounts();

	// Friday, December 31, 2021 11:59:59 PM (GMT)
	const firstSupplyChangeAllowed = 1640995199;
	log(italic(cyanBright(`1] Crown Token (KING)`)));

	// Deploy KING.sol contract
	const deployResult = await deploy('KING', {
		from: deployer,
		contract: 'KING',
		gasLimit: 9500000, // 9,500,000 out of 12,500,000 max gas units
		args: [deployer, deployer, firstSupplyChangeAllowed],
		skipIfAlreadyDeployed: true,
	});
	logDeployResult(deployResult, log);
};

export const tags = ['1', 'governance', 'KING'];
export default func;
