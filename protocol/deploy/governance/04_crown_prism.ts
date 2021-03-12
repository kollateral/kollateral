import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { bold, italic, cyanBright, blueBright, magenta } from 'colorette';
import { logDeployResult } from '../../libs/deploy';
import { validateCrownPrism } from '../../libs/prism/utils';

export const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	const { deployments, getNamedAccounts, ethers } = hre;
	const { deploy, log, execute } = deployments;
	const { deployer, lepidotteri } = await getNamedAccounts();
	const deployerSigner = await ethers.getSigner(deployer);

	log(italic(cyanBright(`4] CrownPrism`)));

	const isCrownPrismValid = await validateCrownPrism();
	if (isCrownPrismValid) {
		// Deploy CrownPrism.sol contract
		const CrownPrism = await deploy('CrownPrism', {
			from: deployer,
			contract: 'CrownPrism',
			gasLimit: 9500000, // 9,500,000 out of 12,500,000 max gas units
			args: [lepidotteri],
			skipIfAlreadyDeployed: true,
		});
		logDeployResult(CrownPrism, log);

		log(italic(cyanBright(`   4.1] Crown (Implementation)`)));
		// Deploy Crown.sol contract
		const CrownImplementation = await deploy('Crown', {
			from: deployer,
			contract: 'Crown',
			gasLimit: 9500000, // 11,500,000 out of 12,500,000 max gas units
			skipIfAlreadyDeployed: false,
		});
		logDeployResult(CrownImplementation, log);

		log(italic(cyanBright(`   4.2] Initialize Crown governance`)));
		const KING = await deployments.get('KING');
		const Monastery = await deployments.get('Monastery');
		const Crown = new ethers.Contract(CrownPrism.address, CrownImplementation.abi, deployerSigner);
		// Set pending implementation for voting power prism
		await execute('CrownPrism', { from: lepidotteri }, 'setPendingProxyImplementation', CrownImplementation.address);
		log(
			`   - Set pending voting power implementation for prism at ${magenta(CrownPrism.address)} to contract at ${magenta(
				CrownImplementation.address
			)}`
		);

		// Accept voting power implementation
		await execute('Crown', { from: lepidotteri }, 'become', CrownPrism.address);
		log(`   - Accepted pending voting power implementation of contract at ${magenta(CrownImplementation.address)}`);

		// Initialize voting power contract
		await execute('Crown', { from: lepidotteri, gasLimit: 555000 }, 'initialize', KING.address, Monastery.address);
		log(`   - Initialized voting power at ${magenta(CrownImplementation.address)} via prism at ${magenta(CrownPrism.address)}`);

		// Set voting power address in vesting contract
		await execute('Monastery', { from: deployer, gasLimit: 555000 }, 'setVotingPowerContract', CrownPrism.address);
		log(`   - Set voting power address in vesting contract at ${magenta(Monastery.address)} to prism at ${magenta(CrownPrism.address)}`);
	} else {
		log(`   - Prism invalid. Please address issues before trying to redeploy`);
		process.exit(1);
	}
};

export const tags = ['4', 'governance', 'CrownPrism'];
export default func;
