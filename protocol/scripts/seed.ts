// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import hre from 'hardhat';

/*
 * This is the pleb way of deploying ("migrating") smart contracts in Hardhat: https://hardhat.org/guides/deploying.html
 * Must only be used for local (i.e. 'hardhat' network) trial and error
 */
async function main() {
	// Hardhat always runs the compile task when running scripts with its command
	// line interface.
	//
	// If this script is run directly using `node` you may want to call compile
	// manually to make sure everything is compiled
	// await hre.run('compile');
	const weirdPK = '1111111111111111111111111111111111111111111111111111111111111111';
	const wallet = new hre.ethers.Wallet(weirdPK);
	console.log(wallet.address);

	// We get the contract to deploy
	const Greeter = await hre.ethers.getContractFactory('Greeter');
	const greeter = await Greeter.deploy('Hello, Hardhat!');

	await greeter.deployed();

	console.log('Greeter deployed to:', greeter.address);

	const greeting = await greeter.callStatic.greet();
	console.log('greeting:', greeting);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
