import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'ethers';

import { italic, cyanBright, bold, gray, magenta, greenBright, underline, bgWhiteBright } from 'colorette';
import { INITIAL_KING_LIQUIDITY, logDeployResult } from '../../libs/deploy';
import { addGrants, distributeUnlockedTokens, grantees } from '../../libs/grants/utils';
import { getEnv } from '../../libs/config';
import { deployments } from 'hardhat';

const KINGMAKER_TREASURY_PK = getEnv('KINGMAKER_TREASURY_PK') || '0x';
const treasury = new ethers.Wallet(KINGMAKER_TREASURY_PK);

export const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	const { deployments, getNamedAccounts, ethers } = hre;
	const { deploy, log, execute } = deployments;
	const { deployer, lepidotteri } = await getNamedAccounts();
	const deployerSigner = await ethers.getSigner(deployer);
	const KING = await deployments.get('KING');
	const decimals = await deployments.read('KING', 'decimals');
	const decimalMultiplier = ethers.BigNumber.from(10).pow(decimals);

	log(cyanBright(`   5.1] Creating (vested) KING grants`));
	// e.g. optionally set start time for grants, unix timestamps
	await addGrants(0);
	log(`   - ` + bold(bgWhiteBright(gray(`All grants have been distributed per instructions`))));

	// Handed vesting contract administration to lepidotteri
	await execute('Monastery', { from: deployer }, 'changeClergy', lepidotteri);
	log(italic(`   - Handed vesting contract admin to ${magenta(lepidotteri)}`));

	log(cyanBright(`   5.2] Distributing Unlocked KING tokens`));
	// Deploy Multisend.sol contract
	const Multisend = await deploy('Multisend', {
		from: deployer,
		contract: 'Multisend',
		gasLimit: 9500000, // 9,500,000 out of 12,500,000 max gas units
		args: [KING.address],
		skipIfAlreadyDeployed: true,
	});
	logDeployResult(Multisend, log);

	await distributeUnlockedTokens();

	const etherAmount = '1';
	// Finally send 1 ether to Treasury to fund Ethereum fees
	await deployerSigner.sendTransaction({
		to: treasury.address,
		value: ethers.utils.parseEther(etherAmount),
	});
	// Send remaining KING balance to Treasury to fund LP and other activities
	await execute('KING', { from: deployer }, 'transfer', treasury.address, INITIAL_KING_LIQUIDITY);
	log(
		`   - Transferred ${greenBright(etherAmount)}Ξ to Treasury address: ${magenta(treasury.address)}`
	);
};

func.skip = async ({ deployments, ethers, network }) => {
	const { log, read } = deployments;

	log(italic(cyanBright(`5] Multisend`)));
	const grants = grantees[network.name];
	if (grants.length > 0) {
		const treasuryBalance = await read('KING', 'balanceOf', treasury.address);
		if (treasuryBalance.gt(0)) {
			log(cyanBright(`   5.2] Distributing Unlocked KING tokens`));
			log(bold(gray(`   - Skipping step, unlocked tokens already distributed`)));
			return true;
		} else {
			return false;
		}
	} else {
		log(cyanBright(`   5.2] Distributing Unlocked KING tokens`));
		log(`   - Skipping step, could not find grants`);
		return true;
	}
};

export const tags = ['5', 'governance', 'Multisend'];
export const dependencies = ['KING'];
export default func;
