import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { cyan, bold, blue, italic, underline, greenBright } from 'colorette';

export const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	const { deployments, getNamedAccounts } = hre;
	const { deploy, log } = deployments;
	const { deployer, lepidotteri } = await getNamedAccounts();

	// Friday, December 31, 2021 11:59:59 PM (GMT)
	const firstSupplyChangeAllowed = 1640995199;
	log(bold(blue(`\n【】GOVERNANCE`)));
	log(italic(cyan(`1) Kingmaker Governance Token`)));

	// Deploy GovernanceToken.sol contract
	const deployResult = await deploy('$KING', {
		from: deployer,
		contract: 'GovernanceToken',
		gasLimit: 9696969, // 9,696,969 out of 12,500,000 max gas units
		args: [lepidotteri, lepidotteri, firstSupplyChangeAllowed],
		skipIfAlreadyDeployed: true,
	});

	if (deployResult.newlyDeployed) {
		if (!deployResult.receipt) {
			throw Error('Deployment receipt is null!');
		}
		// @ts-ignore
		log(`   - ${deployResult.contractName}.sol deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);
	} else {
		log(`   - Deployment skipped, using previous deployment at: ${deployResult.address}`);
	}
};

export const tags = ['1', 'governance'];
export const dependencies = ['Crown'];
export default func;
