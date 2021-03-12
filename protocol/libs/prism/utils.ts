import { ethers } from 'hardhat';
import { ContractFactory } from 'ethers';

function getFunctionSigs(iFace: any) {
	return Object.values(iFace.functions).map((fragment: any) => ({ name: fragment.name, sig: iFace.getSighash(fragment) }));
}

function noSelectorClashes(prism: any, impl: any): boolean {
	const prismSigs: any = getFunctionSigs(prism.interface);
	const impSigs: any = getFunctionSigs(impl.interface);

	let noClashes = true;
	for (const impSig of impSigs) {
		for (const prismSig of prismSigs) {
			if (impSig.sig == prismSig.sig) {
				noClashes = false;
				console.log(
					'Function: ' +
						impSig.name +
						' in implementation contract clashes with ' +
						prismSig.name +
						' in prism contract (signature: ' +
						impSig.sig +
						')'
				);
				console.log('Change function name and/or params for ' + impSig.name);
			}
		}
	}

	return noClashes;
}

export async function validateCrownPrism(): Promise<boolean> {
	const votingPowerPrism: ContractFactory = await ethers.getContractFactory('CrownPrism');
	const votingPowerImpl: ContractFactory = await ethers.getContractFactory('Crown');
	return noSelectorClashes(votingPowerPrism, votingPowerImpl);
}
