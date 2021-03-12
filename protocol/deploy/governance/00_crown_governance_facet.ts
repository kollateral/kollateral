import { Contract } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction, Receipt } from 'hardhat-deploy/types';

import { italic, cyanBright, red, bold, yellow, underline, greenBright, green, blueBright } from 'colorette';

import { logDeployResult } from '../../libs/deploy';
import { O_Address } from '../../libs/ethereum';
import { FacetCutAction, getDiamondFacet, getSelectors } from '../../libs/diamond/utils';

export const func: DeployFunction = async ({ deployments }) => {
	const { log } = deployments;

	/*
	const { deployments, getNamedAccounts, ethers } = hre;
	const { deploy, log, read, execute, rawTx } = deployments;
	const { deployer, lepidotteri } = await getNamedAccounts();

	log(italic(cyanBright(`2) Kingmaker Crown Governance Faucet`)));
	// Deploy CrownGovernanceFacet.sol contract
	const CrownGovernanceFacet = await deploy('CrownGovernanceFacet', {
		from: deployer,
		contract: 'CrownGovernanceFacet',
		args: [],
		skipIfAlreadyDeployed: true,
	});
	logDeployResult(CrownGovernanceFacet, log);

	const Crown = await deployments.get('Crown');
	const DiamondCutFacet = await deployments.get('DiamondCutFacet');

	const diamondCut = [[CrownGovernanceFacet.address, FacetCutAction.Add, getSelectors(CrownGovernanceFacet.abi)]];

	// Hardhat-deploy execute/read methods failed to perform the cut
	log(red(bold('   hardhat-deploy was forced to skip the cut which would have been performed with its built-in support for Diamonds.')));
	log(italic(yellow(`   * TODO: https://github.com/wighawag/hardhat-deploy/issues/72`)));
	// TODO: https://github.com/wighawag/hardhat-deploy/issues/72
	// it should be possible to cut the Governance facet into our Crown without relying on hardhat-deploy built-in Diamonds
	// const cutInTxReceipt: Receipt = await execute('Crown', { from: lepidotteri }, 'diamondCut', diamondCut);
	// console.log(cutInTxReceipt);

	// a second way it should be possible to manually cut the Governance facet into our Crown
	// const cutInTxReceipt2: Receipt = await rawTx({
	//	from: lepidotteri,
	//	to: crown.address,
	//	data: getFacetFunctionCalldata(cutFacet.abi, 'diamondCut', [diamondCut, O_Address, '0x']),
	//});
	//console.log(cutInTxReceipt2);

	// a third way to manually cut the Governance facet into our Crown
	const lepidotteriSig = (await ethers.getSigners())[1];
	const cutFacet: Contract = getDiamondFacet(Crown.address, DiamondCutFacet.abi, lepidotteriSig);
	// TODO: find all facets and their selectors (DiamondLoupeFacet) and evaluate whether we need to add this facet again
	await cutFacet.diamondCut(diamondCut, O_Address, '0x');
	log(`   - Cut in governance facet with ${green('success')}`);

	// We shouldn't normally need a signer for calling a 'pure' function, but Hardhat's ethers (or ethers) doesn't appear to be able to call any methods without one
	const govFacet: Contract = getDiamondFacet(Crown.address, CrownGovernanceFacet.abi, lepidotteriSig);
	const king = await govFacet.govern('lepidotteri');
	log(`   - Governance is: ${underline(greenBright(king))}`);
	*/
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
	const { deployments, getNamedAccounts, ethers } = hre;
	const { log } = deployments;
	log(bold(blueBright(`\n【】GOVERNANCE`)));
	log(italic(cyanBright(`0] Cutting CrownGovernanceFacet into the Crown`)));
	// Hardhat-deploy execute/read methods failed to perform the cut
	log(
		yellow(
			bold(
				'   - Skipping step: hardhat-deploy was forced to skip the cut which would have been performed with its built-in support for Diamonds.'
			)
		)
	);
	log(italic(yellow(`   -> TODO: https://github.com/wighawag/hardhat-deploy/issues/72`)));
	return true;
};

export const tags = ['0', 'governance', 'CrownGovernanceFacet'];
export const dependencies = ['Kingmaker', 'DiamondCutFacet', 'CrownGovernanceToken'];
export default func;
