import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { italic, cyanBright, magenta } from 'colorette';
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
			args: [deployer],
			skipIfAlreadyDeployed: false,
		});
		logDeployResult(CrownPrism, log);

		log(italic(cyanBright(`   4.1] Crown (Implementation)`)));
		// Deploy Crown.sol contract
		const CrownImp = await deploy('Crown', {
			from: deployer,
			contract: 'Crown',
			gasLimit: 9500000, // 9,500,000 out of 12,500,000 max gas units
			skipIfAlreadyDeployed: false,
		});
		logDeployResult(CrownImp, log);

		log(italic(cyanBright(`   4.2] Initializing Crown governance`)));
		const KING = await deployments.get('KING');
		const Monastery = await deployments.get('Monastery');
		const Crown = new ethers.Contract(CrownPrism.address, CrownImp.abi, deployerSigner);
		// Set pending implementation for voting power prism
		await execute('CrownPrism', { from: deployer, gasLimit: 555000 }, 'setPendingProxyImplementation', CrownImp.address);
		log(
			`   - Set pending voting power implementation for prism at ${magenta(CrownPrism.address)} to contract at ${magenta(
				CrownImp.address
			)}`
		);

		// Accept voting power implementation
		await execute('Crown', { from: deployer, gasLimit: 555000 }, 'become', CrownPrism.address);
		log(`   - Accepted pending voting power implementation of contract at ${magenta(CrownImp.address)}`);

		// Initialize voting power contract
		await Crown.initialize(KING.address, Monastery.address, { from: deployer, gasLimit: 555000 });
		log(`   - Initialized implementation voting power at ${magenta(CrownImp.address)} via prism at ${magenta(CrownPrism.address)}`);

		// Set voting power address in vesting contract
		await execute('Monastery', { from: deployer, gasLimit: 555000 }, 'setVotingPowerContract', CrownPrism.address);
		log(`   - Set voting power address in vesting contract at ${magenta(Monastery.address)} to prism at ${magenta(CrownPrism.address)}`);

		// Set pending admin for voting power
		await execute('CrownPrism', { from: deployer, gasLimit: 555000 }, 'setPendingProxyAdmin', lepidotteri);
		log(`   - Set pending voting power admin for prism at ${magenta(CrownPrism.address)} to ${magenta(lepidotteri)}`);
		log(`   - ${magenta(lepidotteri)} may now call 'acceptAdmin' via prism to become the proxy admin`);
	} else {
		log(`   - Prism invalid. Please address issues before trying to redeploy`);
		process.exit(1);
	}
};

export const tags = ['4', 'governance', 'CrownPrism'];
export default func;
