import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { DeployFunction, DeployResult } from 'hardhat-deploy/types';

import { bold, italic, cyanBright, blueBright } from 'colorette';
import { logDeployResult } from '../libs/deploy';
import { FacetCutAction, getSelectors } from '../libs/diamond/utils';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	const { deployments, getNamedAccounts } = hre;
	const { deploy, log } = deployments;
	const { deployer, lepidotteri } = await getNamedAccounts();

	log(italic(cyanBright(`1] Kingmaker Diamond`)));
	// Deploy DiamondCutFacet.sol contract
	const DiamondCutFacet: DeployResult = await deploy('DiamondCutFacet', {
		from: deployer,
		contract: 'DiamondCutFacet',
		args: [],
		skipIfAlreadyDeployed: true,
	});
	logDeployResult(DiamondCutFacet, log);

	// Deploy DiamondLoupeFacet.sol contract
	const DiamondLoupeFacet: DeployResult = await deploy('DiamondLoupeFacet', {
		from: deployer,
		contract: 'DiamondLoupeFacet',
		args: [],
		skipIfAlreadyDeployed: true,
	});
	logDeployResult(DiamondLoupeFacet, log);

	// Deploy OwnershipFacet.sol contract
	const OwnershipFacet: DeployResult = await deploy('OwnershipFacet', {
		from: deployer,
		contract: 'OwnershipFacet',
		args: [],
		skipIfAlreadyDeployed: true,
	});
	logDeployResult(OwnershipFacet, log);

	const diamondCut = [
		[DiamondCutFacet.address, FacetCutAction.Add, getSelectors(DiamondCutFacet.abi)],
		[DiamondLoupeFacet.address, FacetCutAction.Add, getSelectors(DiamondLoupeFacet.abi)],
		[OwnershipFacet.address, FacetCutAction.Add, getSelectors(OwnershipFacet.abi)],
	];

	// Deploy Kingmaker.sol contract
	const Kingmaker: DeployResult = await deploy('Kingmaker', {
		from: deployer,
		contract: 'Kingmaker',
		args: [diamondCut, [lepidotteri]],
		skipIfAlreadyDeployed: true,
	});
	logDeployResult(Kingmaker, log);
};

export const tags = ['1', 'Kingmaker'];
export default func;
