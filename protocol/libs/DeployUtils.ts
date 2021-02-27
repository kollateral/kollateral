// eslint-disable @typescript-eslint/ban-ts-comment
// @ts-ignore
import { ethers } from 'hardhat';
import { Contract, ContractFactory } from 'ethers';
import { DeployResult } from 'hardhat-deploy/types';

import { magenta, gray, bold, strikethrough, yellowBright } from 'colorette';

import * as diamond from './diamond/DiamondUtils';

export async function deployContract(name: string, args?: Array<any>): Promise<Contract> {
	const factory: ContractFactory = await ethers.getContractFactory(name);
	const contract: Contract = await factory.deploy(...(args || []));
	await contract.deployed();

	return contract;
}

export async function deployDiamondContract(diamondArtifactName: string, facets: Array<Contract>, owner: string): Promise<Contract> {
	const diamondCut = [];

	for (const facet of facets) {
		diamondCut.push([facet.address, diamond.FacetCutAction.Add, diamond.alternativeGetSelectors(facet)]);
	}

	return deployContract(diamondArtifactName, [diamondCut, owner]);
}

export function logDeployResult(deployResult: DeployResult, logger: (...args: any[]) => void): void {
	if (deployResult.newlyDeployed) {
		if (!deployResult.receipt) {
			throw Error('Deployment receipt is null!');
		}

		logger(
			'   -',
			// @ts-ignore
			deployResult.contractName + '.sol',
			'deployed at',
			magenta(deployResult.address),
			'using',
			bold(gray(deployResult.receipt.gasUsed.toString())),
			'gas'
		);
	} else {
		// @ts-ignore
		logger(`   - ${strikethrough(yellowBright('Deployment skipped'))}, using previous deployment at ${magenta(deployResult.address)}`);
	}
}
