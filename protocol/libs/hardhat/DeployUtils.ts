import { DeployResult } from 'hardhat-deploy/types';
import {magenta, yellow, gray, bold, strikethrough, yellowBright} from 'colorette';

export function logDeployResult(deployResult: DeployResult, logger: (...args: any[]) => void): void {
	if (deployResult.newlyDeployed) {
		if (!deployResult.receipt) {
			throw Error('Deployment receipt is null!');
		}
		// @ts-ignore
		logger(`   - ${deployResult.contractName}.sol deployed at ${ magenta(deployResult.address) } using ${ bold(gray(deployResult.receipt.gasUsed)) } gas`);
	} else {
		// @ts-ignore
		logger(`   - ${ strikethrough(yellowBright('Deployment skipped')) }, using previous deployment at ${ magenta(deployResult.address) }`);
	}
}
