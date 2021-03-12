import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { bold, italic, cyanBright, blueBright, magenta } from 'colorette';
import { logDeployResult } from '../../libs/deploy';

export const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	const { deployments, getNamedAccounts } = hre;
	const { deploy, log, execute } = deployments;
	const { deployer, lepidotteri } = await getNamedAccounts();
	const KING = await deployments.get('KING');

	log(italic(cyanBright(`2] Monastery (KING Vesting)`)));
	// Deploy Monastery.sol contract
	const Monastery = await deploy('Monastery', {
		from: deployer,
		contract: 'Monastery',
		gasLimit: 9500000, // 9,500,000 out of 12,500,000 max gas units
		args: [KING.address],
		skipIfAlreadyDeployed: true,
	});
	logDeployResult(Monastery, log);
};

export const tags = ['2', 'governance', 'Monastery'];
export const dependencies = ['KING'];
export default func;
