import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { italic, cyanBright, magenta } from 'colorette';
import {logDeployResult, SUSHI_POOL_ADDRESS} from '../../libs/deploy';

export const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	const { deployments, getNamedAccounts } = hre;
	const { deploy, log } = deployments;
	const { deployer, lepidotteri } = await getNamedAccounts();

	log(italic(cyanBright(`8] Crown Formulae`)));
	// Deploy KingmakerFormula.sol contract
	const KingmakerFormula = await deploy('KingmakerFormula', {
		from: deployer,
		contract: 'KingmakerFormula',
		gasLimit: 9500000, // 9,500,000 out of 12,500,000 max gas units
		skipIfAlreadyDeployed: true,
	});
	logDeployResult(KingmakerFormula, log);

	const KING = await deployments.get("KING")
	// Deploy Token Registry contract
	const Scribe = await deploy("Scribe", {
		from: deployer,
		contract: "Scribe",
		gasLimit: 9500000,
		args: [lepidotteri, [KING.address], [KingmakerFormula.address]],
		skipIfAlreadyDeployed: true
	});
	logDeployResult(Scribe, log);
};

export const tags = ['8', 'governance', 'Formulae'];
export const dependencies = ['KING', '7'];
export default func;
