// eslint-disable @typescript-eslint/ban-ts-comment
// @ts-ignore
import { ethers } from 'hardhat';
import { Contract, ContractFactory } from 'ethers';
import { DeployResult } from 'hardhat-deploy/types';

import { magenta, gray, bold, strikethrough, yellowBright } from 'colorette';

import * as diamond from './diamond/utils';
import { year } from './time';

const now = parseInt(String(Date.now() / 1000));

export const FIRST_KING_SUPPLY_CHANGE = now + year;

export const SUSHI_ADDRESS = '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2';
export const MASTERCHEF_ADDRESS = '0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd';
export const SUSHI_ROUTER_ADDRESS = '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F';
export const SUSHI_FACTORY_ADDRESS = '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac';
export const SUSHI_POOL_ADDRESS = '0x4441eb3076f828D5176f4Fe74d7c775542daE106';
export const SUSHI_LP_VP_CVR = '3500000';
export const MASTERCHEF_POOL_ID = '68';

export const INITIAL_KING_TREASURY = '180000000000000000000'; // 1800 KING
export const INITIAL_KING_OFFERING = '450000000000000000000'; // 4500 KING
export const INITIAL_KING_LIQUIDITY = '270000000000000000000'; // 2700 KING
export const INITIAL_KING_REWARDS_BALANCE = '900000000000000000000'; // 900 KING
export const TARGET_KING_LIQUIDITY = '90000000000000000000'; // 90 KING
export const KING_REWARDS_START_BLOCK = '0';
export const KING_REWARDS_PER_BLOCK = '9000000000000000000'; // 9 KING
export const TARGET_WETH_LIQUIDITY = '10000000000000000000'; // 10 ETH

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
