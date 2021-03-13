import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'ethers';

import { italic, cyanBright, greenBright, redBright, whiteBright } from 'colorette';
import { TARGET_KING_LIQUIDITY, TARGET_WETH_LIQUIDITY } from '../../libs/deploy';
import { getEnv } from '../../libs/config';
import { UNI_ROUTER_ABI, UNI_ROUTER_ADDRESS, WETH_ABI, WETH_LiquidityFor } from '../../libs/liquidity/uniswap';

const KINGMAKER_TREASURY_PK = getEnv('KINGMAKER_TREASURY_PK') || '0x';
const treasury = new ethers.Wallet(KINGMAKER_TREASURY_PK);

export const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	const { deployments, ethers, getNamedAccounts } = hre;
	const { log, execute } = deployments;
	const { deployer } = await getNamedAccounts();
	const deployerSigner = await ethers.getSigner(deployer);
	const KING = await deployments.get('KING');
	const uniRouter = new ethers.Contract(UNI_ROUTER_ADDRESS, UNI_ROUTER_ABI, deployerSigner);

	log(italic(cyanBright(`6] Create WETH-KING Uniswap market`)));
	// Approve Uniswap router to move `TARGET_KING_LIQUIDITY` tokens
	await execute('KING', { from: deployer }, 'approve', UNI_ROUTER_ADDRESS, TARGET_KING_LIQUIDITY);

	const kingDecimals = await deployments.read('KING', 'decimals');
	const kdMultiplier = ethers.BigNumber.from(10).pow(kingDecimals);

	const WETH_ADDRESS = await uniRouter.WETH();
	const weth = new ethers.Contract(WETH_ADDRESS, WETH_ABI, deployerSigner);
	const wethDecimals = await deployments.read('KING', 'decimals');
	const wdMultiplier = ethers.BigNumber.from(10).pow(wethDecimals);
	await weth.approve(UNI_ROUTER_ADDRESS, TARGET_WETH_LIQUIDITY);

	// Deadline for adding liquidity = now + 10 minutes
	const deadline = parseInt(String(Date.now() / 1000)) + 600;

	// Create Uniswap market + provide initial liquidity
	const result = await uniRouter.addLiquidityETH(
		KING.address,
		TARGET_KING_LIQUIDITY,
		TARGET_KING_LIQUIDITY,
		TARGET_WETH_LIQUIDITY,
		treasury.address,
		deadline,
		{ from: deployer, value: TARGET_WETH_LIQUIDITY, gasLimit: 5555555 }
	);
	if (result.hash) {
		const receipt = await ethers.provider.waitForTransaction(result.hash);
		if (receipt.status === 1) {
			const { ethLiquidity, tokenLiquidity } = await WETH_LiquidityFor(KING.address);
			log(
				`   - Created Uniswap market (WETH: ${greenBright(ethLiquidity.div(wdMultiplier).toString())}, KING: ${greenBright(
					tokenLiquidity.div(kdMultiplier).toString()
				)})`
			);
		} else {
			log(`   - Error creating Uniswap market. Tx: ${redBright(receipt.transactionHash)}`);
			process.exit(1);
		}
	} else {
		log(`   - Error creating Uniswap market: ${redBright(result)}`);
		process.exit(1);
	}
};

func.skip = async ({ deployments, ethers, getNamedAccounts }) => {
	const { log, read } = deployments;
	const { deployer } = await getNamedAccounts();
	const KING = await deployments.get('KING');
	const { tokenLiquidity } = await WETH_LiquidityFor(KING.address);

	const lpETHBalance = await ethers.provider.getBalance(deployer);
	const lpTokenBalance = await read('KING', 'balanceOf', deployer);

	if (tokenLiquidity.gte(TARGET_KING_LIQUIDITY)) {
		log(italic(cyanBright(`6] Create WETH-KING Uniswap market`)));
		log(whiteBright(`   - Skipping step, Uniswap liquidity already provided`));
		return true;
	} else if (lpTokenBalance.lt(TARGET_KING_LIQUIDITY)) {
		log(italic(cyanBright(`6] Create WETH-KING Uniswap market`)));
		log(whiteBright(`   - Skipping step, liquidity provider account does not have enough tokens`));
		return true;
	} else if (lpETHBalance.lt(TARGET_WETH_LIQUIDITY)) {
		log(italic(cyanBright(`6] Create WETH-KING Uniswap market`)));
		log(whiteBright(`   - Skipping step, liquidity provider account does not have enough ETH`));
		return true;
	} else {
		return false;
	}
};

export const tags = ['6', 'governance', 'UniswapMarket'];
export const dependencies = ['Multisend'];
export default func;
