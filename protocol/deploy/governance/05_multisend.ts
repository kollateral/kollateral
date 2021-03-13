import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'ethers';

import {italic, cyanBright, bold, gray, magenta, greenBright} from 'colorette';
import { INITIAL_KING_LIQUIDITY, logDeployResult } from '../../libs/deploy';
import { addGrants, distributeUnlockedTokens, grantees } from '../../libs/grants/utils';
import { getEnv } from '../../libs/config';

const KINGMAKER_TREASURY_PK = getEnv('KINGMAKER_TREASURY_PK') || '0x';
const treasury = new ethers.Wallet(KINGMAKER_TREASURY_PK);

export const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	const { deployments, getNamedAccounts } = hre;
	const { deploy, log, execute } = deployments;
	const { deployer, lepidotteri } = await getNamedAccounts();
	const KING = await deployments.get('KING');

	log(cyanBright(`   6.1] Creating (vested) KING grants`));
	// e.g. optionally set start time for grants, unix timestamps
	await addGrants(0);
	log(`   - All grants have been distributed per instructions`);

	// Handed vesting contract administration to lepidotteri
	await execute('Monastery', { from: deployer }, 'changeClergy', lepidotteri);
	log(italic(`   - Handed vesting contract admin to ${magenta(lepidotteri)}`));

	log(cyanBright(`   6.2] Distributing Unlocked KING tokens`));
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

	await execute('KING', { from: deployer }, 'transfer', treasury.address, INITIAL_KING_LIQUIDITY);
	log(`   - Transferred ${greenBright(INITIAL_KING_LIQUIDITY)} tokens to treasury (liquidity provider) at ${magenta(treasury.address)}`);
};

func.skip = async ({ deployments, ethers, network }) => {
	const { log, read } = deployments;

	log(italic(cyanBright(`6] Multisend`)));
	const grants = grantees[network.name];
	if (grants.length > 0) {
		const treasuryBalance = await read('KING', 'balanceOf', treasury.address);
		if (treasuryBalance.gt(0)) {
			log(cyanBright(`   6.2] Distributing Unlocked KING tokens`));
			log(bold(gray(`   - Skipping step, unlocked tokens already distributed`)));
			return true;
		} else {
			return false;
		}
	} else {
		log(cyanBright(`   6.2] Distributing Unlocked KING tokens`));
		log(`   - Skipping step, could not find grants`);
		return true;
	}
};

export const tags = ['5', 'governance', 'Multisend'];
export const dependencies = ['KING'];
export default func;
