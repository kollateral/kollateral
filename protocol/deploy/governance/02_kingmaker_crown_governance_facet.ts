import { Contract } from "ethers";
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction, Receipt } from 'hardhat-deploy/types';

import { italic, cyanBright, red, bold, yellow, underline, greenBright } from 'colorette';

import { logDeployResult } from '../../libs/DeployUtils';
import { O_Address } from '../../libs/EthereumUtils';
import { FacetCutAction, getDiamondFacet, getSelectors } from '../../libs/diamond/DiamondUtils';

export const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	const { deployments, getNamedAccounts, ethers } = hre;
	const { deploy, log, read, execute, rawTx } = deployments;
	const { deployer, lepidotteri } = await getNamedAccounts();

	log(italic(cyanBright(`2) Kingmaker Crown Governance Faucet`)));
	// Deploy GovernanceToken.sol contract
	const CrownGovernanceFacet = await deploy('CrownGovernanceFacet', {
		from: deployer,
		contract: 'CrownGovernanceFacet',
		args: [],
		skipIfAlreadyDeployed: false,
	});
	logDeployResult(CrownGovernanceFacet, log);

	log(italic(cyanBright(`2.1) Cut Governance Faucet into the Crown`)));
	const Crown = await deployments.get('Crown');
	const DiamondCutFacet = await deployments.get('DiamondCutFacet');

	const diamondCut = [[ CrownGovernanceFacet.address, FacetCutAction.Add, getSelectors(CrownGovernanceFacet.abi) ]];

	log(italic(yellow(`   - TODO: https://github.com/wighawag/hardhat-deploy/issues/72`)));
	//  TODO: https://github.com/wighawag/hardhat-deploy/issues/72
	// it should be possible to cut the Governance facet into our Crown without relying on hardhat-deploy built-in Diamonds
	// const cutInTxReceipt: Receipt = await execute('Crown', { from: lepidotteri }, 'diamondCut', diamondCut);
	// console.log(cutInTxReceipt);

	// a second way, it could be possible to manually cut the Governance facet into our Crown this way...
	// const cutInTxReceipt2: Receipt = await rawTx({
	//	from: lepidotteri,
	//	to: crown.address,
	//	data: getFacetFunctionCalldata(cutFacet.abi, 'diamondCut', [diamondCut, O_Address, '0x']),
	//});
	//console.log(cutInTxReceipt2);

	// Hardhat-deploy execute/read methods failed to perform the cut
	console.log(red(bold('hardhat-deploy was forced to skip the cut which would have been performed with its built-in support for Diamonds.')));

	// a third way to manually cut the Governance facet into our Crown
	const lepidotteriSig = (await ethers.getSigners())[1];
	const cutFacet: Contract = getDiamondFacet(Crown.address, DiamondCutFacet.abi, lepidotteriSig);
	// TODO: find all facets and their selectors (DiamondLoupeFacet) and evaluate whether we need to add this facet again
	await cutFacet.diamondCut(diamondCut, O_Address, '0x');
	// We shouldn't normally need a signer for calling a 'pure' function, but Hardhat's ethers doesn't appear to call any methods without one
	const govFacet: Contract = getDiamondFacet(Crown.address, CrownGovernanceFacet.abi, lepidotteriSig);
	const king = await govFacet.callStatic.govern('lepidotteri');
	log(`   - Governance is: ${underline(greenBright(king))}`);
};

export const tags = ['2', 'governance', 'CrownGovernanceFacet'];
export const dependencies = ['Crown', 'DiamondCutFacet', 'GovernanceToken'];
export default func;
