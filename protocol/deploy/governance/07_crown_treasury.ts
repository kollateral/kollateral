import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { italic, cyanBright, magenta } from 'colorette';
import { logDeployResult } from '../../libs/deploy';

export const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	const { deployments, getNamedAccounts } = hre;
	const { deploy, log } = deployments;
	const { deployer, lepidotteri } = await getNamedAccounts();
	const CrownPrism = await deployments.get('CrownPrism');

	log(italic(cyanBright(`7] Crown Treasury`)));
	// Deploy Lord.sol contract
	const Lord = await deploy('Lord', {
		from: deployer,
		contract: 'Lord',
		gasLimit: 9500000, // 9,500,000 out of 12,500,000 max gas units
		args: [CrownPrism.address, lepidotteri],
		skipIfAlreadyDeployed: true,
	});
	logDeployResult(Lord, log);

	// Deploy Vault .sol contract
	const Treasury = await deploy('Treasury', {
		from: deployer,
		contract: 'Treasury',
		gasLimit: 9500000, // 9,500,000 out of 12,500,000 max gas units
		args: [Lord.address],
		skipIfAlreadyDeployed: true,
	});
	logDeployResult(Treasury, log);
};

export const tags = ['7', 'governance', 'Treasury'];
export const dependencies = ['Crown'];
export default func;
