// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import hre from 'hardhat';
import { to10Pow18 } from '../libs/ethereum';

/*
 * Must only be used for local (i.e. 'hardhat' network) trial and error
 */
async function main() {
	const { deployments, getNamedAccounts, ethers } = hre;
	const { deploy, log, read, execute, rawTx } = deployments;

	const namedAccounts = await getNamedAccounts();

	const decimalsAmount = ethers.BigNumber.from('11100000000000000000');
	const decaAmount = decimalsAmount.div(to10Pow18);

	console.log('BASE10:', decaAmount.toString());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
