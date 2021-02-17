import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction, Receipt } from 'hardhat-deploy/types';

import { italic, cyanBright, red, bold, yellow, underline, greenBright } from 'colorette';
import { logDeployResult } from '../../libs/hardhat/DeployUtils';
import { FacetCutAction, getFacetFunctionCalldata, getSelectors } from '../../libs/CrownHelper';
import { O_Address } from '../../libs/EthereumUtils';

export const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	const { deployments, getNamedAccounts, ethers } = hre;
	const { deploy, log, read, execute, rawTx } = deployments;
	const { deployer, lepidotteri } = await getNamedAccounts();

	log(italic(cyanBright(`2) Kingmaker Governance Faucet`)));
	// Deploy GovernanceToken.sol contract
	const governanceFacet = await deploy('GovernanceFaucet', {
		from: deployer,
		contract: 'GovernanceFaucet',
		args: [],
		skipIfAlreadyDeployed: true,
	});
	logDeployResult(governanceFacet, log);

	log(italic(cyanBright(`2.1) Cut Governance Faucet into the Crown`)));
	const crown = await deployments.get('Crown');
	const cutFacet = await deployments.get('DiamondCutFacet');
	const diamondCut = [[governanceFacet.address, FacetCutAction.Add, getSelectors(governanceFacet.abi)]];

	log(italic(yellow(`   - TODO: https://github.com/wighawag/hardhat-deploy/issues/72`)));
	//  TODO: https://github.com/wighawag/hardhat-deploy/issues/72
	// it ought to be possible to manually cut the Governance facet into our Crown without relying on hardhat-deploy Diamonds support
	// const cutInTxReceipt: Receipt = await execute('Crown', { from: lepidotteri }, 'diamondCut', diamondCut);
	// console.log(cutInTxReceipt);

	// another way it should be possible to manually cut the Governance facet into our Crown
	// const cutInTxReceipt2: Receipt = await rawTx({
	//	from: lepidotteri,
	//	to: crown.address,
	//	data: getFacetFunctionCalldata(cutFacet.abi, 'diamondCut', [diamondCut, O_Address, '0x']),
	//});
	//console.log(cutInTxReceipt2);

	// Hardhat-deploy execute/read methods failed to perform the cut
	console.log(red(bold('hardhat-deploy failed to perform the cut.')));

	// a third way to manually cut the Governance facet into our Crown (unused)
	const lepidotteriSig = (await ethers.getSigners())[1];
	const DiamondCutFacet = new ethers.Contract(crown.address, cutFacet.abi, lepidotteriSig);
	await DiamondCutFacet.diamondCut(diamondCut, O_Address, '0x');

	// const rawTxRes = await lepidotteriSig.sendTransaction({
	//	to: crown.address,
	//	data: getFacetFunctionCalldata(cutFacet.abi, 'diamondCut', [diamondCut, O_Address, '0x']),
	// });

	// const greeting = await read('Crown', { from: lepidotteri }, 'govern', 'lepidotteri');
	const GovernanceFaucet = new ethers.Contract(crown.address, governanceFacet.abi, lepidotteriSig);
	const king = await GovernanceFaucet.callStatic.govern('lepidotteri');
	log(`   - Governance is: ${underline(greenBright(king))}`);
};

export const tags = ['2', 'governance', 'GovernanceFaucet'];
export const dependencies = ['Crown', 'DiamondCutFacet', 'GovernanceToken'];
export default func;
