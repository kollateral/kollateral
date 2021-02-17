import { DeployResult } from 'hardhat-deploy/types';
import { magenta, gray, bold, strikethrough, yellowBright } from 'colorette';

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
