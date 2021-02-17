import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction, Receipt } from 'hardhat-deploy/types';

import {italic, cyanBright, red, bold, yellow} from 'colorette';
import { logDeployResult } from '../../libs/hardhat/DeployUtils';
import { FacetCutAction, getFacetFunctionCalldata, getSelectors } from '../../libs/CrownHelper';

export const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	const { deployments, getNamedAccounts, ethers } = hre;
	const { deploy, log, read, execute, rawTx } = deployments;
	const { deployer, lepidotteri } = await getNamedAccounts();

	log(italic(cyanBright(`2) Kingmaker Governance Faucet`)));
	log(italic(yellow(`   - TODO: https://github.com/wighawag/hardhat-deploy/issues/71`)));
	// Deploy GovernanceToken.sol contract
	//  TODO: https://github.com/wighawag/hardhat-deploy/issues/71
	const governanceFacet = await deploy('GovernanceFaucet', {
		from: deployer,
		contract: 'GovernanceFaucet',
		args: [],
		skipIfAlreadyDeployed: true,
	});
	logDeployResult(governanceFacet, log);

	log(italic(cyanBright(`2.1) Cut Governance Faucet into the Crown`)));
	const crown = await deployments.get('Crown');
	const diamondCut = [[governanceFacet.address, FacetCutAction.Add, getSelectors(governanceFacet.abi)]];

	try {
		// to manually cut the Governance facet into our Crown without relying on hardhat-deploy Diamonds support
		const cutInTxReceipt: Receipt = await execute('Crown', { from: lepidotteri }, 'diamondCut', diamondCut);
		console.log(cutInTxReceipt);

		// another way to manually cut the Governance facet into our Crown
		const cutInTxReceipt2: Receipt = await rawTx({
			from: lepidotteri,
			to: crown.address,
			data: getFacetFunctionCalldata(governanceFacet.abi, 'diamondCut', diamondCut),
		});
		console.log(cutInTxReceipt2);

		// a third way to manually cut the Governance facet into our Crown
		const lepidotteriSig = (await ethers.getSigners())[0];
		const rawTxRes = await lepidotteriSig.sendTransaction({
			to: crown.address,
			data: getFacetFunctionCalldata(governanceFacet.abi, 'diamondCut', diamondCut),
		});
		console.log(rawTxRes);

	} catch (e) {
		// Hardhat-deploy execute/read methods failed to perform the cut
		console.log(red(bold('hardhat-deploy and ethers failed to perform the cut')));
	}

	// const greeting = await read('Crown', { from: lepidotteri }, 'govern', 'lepidotteri');
	// log(`   - Governance is: ${underline(greenBright(greeting))}`);
};

export const tags = ['2', 'governance', 'GovernanceFaucet'];
export const dependencies = ['Crown', 'DiamondCutFacet', 'GovernanceToken'];
export default func;
