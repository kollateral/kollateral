import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { bold, italic, cyanBright, blueBright } from 'colorette';
import { logDeployResult } from '../../libs/DeployUtils';

export const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	const { deployments, getNamedAccounts } = hre;
	const { deploy, log } = deployments;
	const { deployer, lepidotteri } = await getNamedAccounts();

	// Friday, December 31, 2021 11:59:59 PM (GMT)
	const firstSupplyChangeAllowed = 1640995199;
	log(bold(blueBright(`\n【】GOVERNANCE`)));
	log(italic(cyanBright(`1) Kingmaker Crown Governance Token`)));

	// Deploy CrownGovernanceToken.sol contract
	const deployResult = await deploy('CrownGovernanceToken', {
		from: deployer,
		contract: 'CrownGovernanceToken',
		gasLimit: 9696969, // 9,696,969 out of 12,500,000 max gas units
		args: [lepidotteri, lepidotteri, firstSupplyChangeAllowed],
		skipIfAlreadyDeployed: true,
	});
	logDeployResult(deployResult, log);
};

export const tags = ['1', 'governance', 'CrownGovernanceToken'];
export const dependencies = ['Crown'];
export default func;
