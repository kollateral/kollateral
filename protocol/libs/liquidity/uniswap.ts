import { ethers, getNamedAccounts } from 'hardhat';
import { O_Address } from '../ethereum';

export const UNI_ROUTER_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
export const UNI_ROUTER_ABI = [
	{
		inputs: [],
		name: 'WETH',
		outputs: [
			{
				internalType: 'address',
				name: '',
				type: 'address',
			},
		],
		stateMutability: 'pure',
		type: 'function',
	},
	{
		inputs: [],
		name: 'factory',
		outputs: [
			{
				internalType: 'address',
				name: '',
				type: 'address',
			},
		],
		stateMutability: 'pure',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: 'token',
				type: 'address',
			},
			{
				internalType: 'uint256',
				name: 'amountTokenDesired',
				type: 'uint256',
			},
			{
				internalType: 'uint256',
				name: 'amountTokenMin',
				type: 'uint256',
			},
			{
				internalType: 'uint256',
				name: 'amountETHMin',
				type: 'uint256',
			},
			{
				internalType: 'address',
				name: 'to',
				type: 'address',
			},
			{
				internalType: 'uint256',
				name: 'deadline',
				type: 'uint256',
			},
		],
		name: 'addLiquidityETH',
		outputs: [
			{
				internalType: 'uint256',
				name: 'amountToken',
				type: 'uint256',
			},
			{
				internalType: 'uint256',
				name: 'amountETH',
				type: 'uint256',
			},
			{
				internalType: 'uint256',
				name: 'liquidity',
				type: 'uint256',
			},
		],
		stateMutability: 'payable',
		type: 'function',
	},
];

const UNI_FACTORY_ABI = [
	{
		constant: true,
		inputs: [
			{
				internalType: 'address',
				name: 'tokenA',
				type: 'address',
			},
			{
				internalType: 'address',
				name: 'tokenB',
				type: 'address',
			},
		],
		name: 'getPair',
		outputs: [
			{
				internalType: 'address',
				name: 'pair',
				type: 'address',
			},
		],
		payable: false,
		stateMutability: 'view',
		type: 'function',
	},
];
const UNI_PAIR_ABI = [
	{
		constant: true,
		inputs: [],
		name: 'getReserves',
		outputs: [
			{
				internalType: 'uint112',
				name: 'reserve0',
				type: 'uint112',
			},
			{
				internalType: 'uint112',
				name: 'reserve1',
				type: 'uint112',
			},
			{
				internalType: 'uint32',
				name: 'blockTimestampLast',
				type: 'uint32',
			},
		],
		payable: false,
		stateMutability: 'view',
		type: 'function',
	},
];

export const WETH_ABI = [
	{
		constant: false,
		inputs: [
			{
				name: 'guy',
				type: 'address',
			},
			{
				name: 'wad',
				type: 'uint256',
			},
		],
		name: 'approve',
		outputs: [
			{
				name: '',
				type: 'bool',
			},
		],
		payable: false,
		stateMutability: 'nonpayable',
		type: 'function',
	},
];

export async function WETH_LiquidityFor(token: string): Promise<any> {
	const { deployer } = await getNamedAccounts();
	const deployerSigner = await ethers.getSigner(deployer);

	const uniRouter = new ethers.Contract(UNI_ROUTER_ADDRESS, UNI_ROUTER_ABI, deployerSigner);
	const UNI_FACTORY_ADDRESS = await uniRouter.factory();
	const WETH_ADDRESS = await uniRouter.WETH();
	const uniFactory = new ethers.Contract(UNI_FACTORY_ADDRESS, UNI_FACTORY_ABI, deployerSigner);
	const UNI_PAIR_ADDRESS = await uniFactory.getPair(WETH_ADDRESS, token);

	if (UNI_PAIR_ADDRESS && UNI_PAIR_ADDRESS != O_Address) {
		const uniPair = new ethers.Contract(UNI_PAIR_ADDRESS, UNI_PAIR_ABI, deployerSigner);
		const { reserve0, reserve1 } = await uniPair.getReserves();
		return { poolAddress: UNI_PAIR_ADDRESS, tokenLiquidity: reserve0, ethLiquidity: reserve1 };
	} else {
		return { poolAddress: O_Address, tokenLiquidity: ethers.BigNumber.from('0'), ethLiquidity: ethers.BigNumber.from('0') };
	}
}

export async function printWETHLPDetailsFor(token: string): Promise<void> {
	const { poolAddress, tokenLiquidity, ethLiquidity } = await WETH_LiquidityFor(token);
	console.log('Pool: ' + poolAddress);
	console.log('WETH Liquidity: ' + ethLiquidity);
	console.log('Token Liquidity: ' + tokenLiquidity);
}
