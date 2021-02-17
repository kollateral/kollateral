import { ABI } from 'hardhat-deploy/types';
import { ethers } from 'ethers';

export const FacetCutAction = {
	Add: 0,
	Replace: 1,
	Remove: 2,
};

export function getSelectors(abi: ABI): any {
	const contractInterface = new ethers.utils.Interface(abi);
	return abi.reduce((acc, value) => {
		if (value.type === 'function') {
			const selector = contractInterface.getSighash(value.name);
			acc.push(selector);
			return acc;
		} else {
			return acc;
		}
	}, []);
	// OR -> https://github.com/ethers-io/ethers.js/issues/1299#issuecomment-780107647
	// const iFace = new ethers.utils.Interface(abi);
	// getFragment("functionName").format()
	// ...
}

export function getFacetFunctionCalldata(facetAbi: ABI, funcName: string, ...args: any[]): string {
	const iFace = new ethers.utils.Interface(facetAbi);
	return iFace.encodeFunctionData(funcName, args);
}
