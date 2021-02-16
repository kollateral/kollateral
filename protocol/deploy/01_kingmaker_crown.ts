import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction, Deployment, DeployResult } from 'hardhat-deploy/types';
import { ethers } from 'ethers';
import { cyan, bold, blue, italic } from 'colorette';

const FacetCutAction = {
	Add: 0,
	Replace: 1,
	Remove: 2,
};

function getSelectors(deployment: Deployment) {
	const contractInterface = new ethers.utils.Interface(deployment.abi);
	const selectors = deployment.abi.reduce((acc, value) => {
		if (value.type === 'function') {
			const selector = contractInterface.getSighash(value.name);
			acc.push(selector);
			return acc;
		} else {
			return acc;
		}
	}, []);
	return selectors;
}

function logDeployResult(deployResult: DeployResult, logger: any) {
	if (deployResult.newlyDeployed) {
		if (!deployResult.receipt) {
			throw Error('Deployment receipt is null!');
		}
		// @ts-ignore
		logger(`   - ${deployResult.contractName}.sol deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);
	} else {
		// @ts-ignore
		logger(`   - ${deployResult.contractName} deployment skipped, using previous deployment at: ${deployResult.address}`);
	}
}

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	const { deployments, getNamedAccounts } = hre;
	const { deploy, log } = deployments;
	const { deployer, lepidotteri } = await getNamedAccounts();

	log(bold(blue(`\n【】CROWN`)));
	log(italic(cyan(`1A) Kingmaker Crown`)));

	// Deploy DiamondCutFacet.sol contract
	const cutFacet: DeployResult = await deploy('DiamondCutFacet', {
		from: deployer,
		contract: 'DiamondCutFacet',
		args: [],
		skipIfAlreadyDeployed: true,
	});
	logDeployResult(cutFacet, log);

	// Deploy DiamondLoupeFacet.sol contract
	const loupeFacet: DeployResult = await deploy('DiamondLoupeFacet', {
		from: deployer,
		contract: 'DiamondLoupeFacet',
		args: [],
		skipIfAlreadyDeployed: true,
	});
	logDeployResult(loupeFacet, log);

	// Deploy OwnershipFacet.sol contract
	const ownershipFacet: DeployResult = await deploy('OwnershipFacet', {
		from: deployer,
		contract: 'OwnershipFacet',
		args: [],
		skipIfAlreadyDeployed: true,
	});
	logDeployResult(ownershipFacet, log);

	const diamondCut = [
		[cutFacet.address, FacetCutAction.Add, getSelectors(cutFacet)],
		[loupeFacet.address, FacetCutAction.Add, getSelectors(loupeFacet)],
		[ownershipFacet.address, FacetCutAction.Add, getSelectors(ownershipFacet)],
	];

	// Deploy Crown.sol contract
	const crown: DeployResult = await deploy('Crown', {
		from: deployer,
		contract: 'Crown',
		args: [diamondCut, [lepidotteri]],
		skipIfAlreadyDeployed: true,
	});
	logDeployResult(crown, log);
};

export const tags = ['1', 'Crown'];
export default func;
