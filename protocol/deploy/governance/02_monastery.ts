import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { italic, cyanBright, magenta } from 'colorette';
import { logDeployResult } from '../../libs/deploy';

export const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	const { deployments, getNamedAccounts, ethers } = hre;
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

	// Set max approval for vesting contract to transfer deployer's tokens (used in grants distribution)
	await execute('KING', { from: deployer }, 'approve', Monastery.address, ethers.constants.MaxUint256);
	log(`   - Set max approval for vesting contract at ${magenta(Monastery.address)} for deployer: ${magenta(deployer)}`);
};

export const tags = ['2', 'governance', 'Monastery'];
export const dependencies = ['KING'];
export default func;
