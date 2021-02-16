import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-ethers';
import 'hardhat-deploy';
import 'hardhat-deploy-ethers';
// import "hardhat-typechain";
import 'hardhat-log-remover';
import 'hardhat-gas-reporter';
import 'solidity-coverage';
// import "@tenderly/hardhat-tenderly"

import 'dotenv/config';
import { HardhatUserConfig } from 'hardhat/config';

import chalk from 'chalk';

function getEnv(key: string): string | undefined {
	const variable = process.env[key];
	if (variable === undefined) {
		return undefined;
	}
	return variable.trim();
}

function printWarning(env: string) {
	console.warn(chalk.bold.yellowBright.bgBlackBright(`TEST RUN INCOMPLETE: Set the env variable ${env} in /protocol/.env`));
}

const projectId = getEnv('ALCHEMY_PROJECT_ID') || '0xFEAD';
const deployerPK = getEnv('KINGMAKER_DEPLOYER_PK') || '0xDEAD';
const deployerAddr = getEnv('KINGMAKER_DEPLOYER_ADDR') || '0xC0DE';
const deployer = {
	privateKey: '0xb7d5e9cbedf93abcfea27ff147a316568b7f58cbf8125de65437208509c42f94',
	balance: '10000000000000000000000',
};
const feeCollector = {
	privateKey: '0x547c0b03b0988e67bf0557c3bf0230b03e83e481e3047ba63a96660ca79cbaa1',
	balance: '10000000000000000000000',
};
const lepidotteri = {
	privateKey: '0xd0f1f5f4bd9f4b990240a689d568abd1d5f2a1e6b6d220b86d66891722e5313a',
	balance: '10000000000000000000000',
};
const SHA_2048 = {
	privateKey: '0x1febd0c69f2138a7dcedd7d9d6e481b6eb2a607c205905a47f77fcd7bf0f599e',
	balance: '10000000000000000000000',
};

if (projectId === undefined || projectId === '0xFEAD') {
	printWarning('ALCHEMY_PROJECT_ID');
}
if (deployerPK === undefined || deployerPK === '0xDEAD') {
	printWarning('KINGMAKER_DEPLOYER_PK');
}
if (deployerAddr === undefined || deployerAddr === '0xC0DE') {
	printWarning('KINGMAKER_DEPLOYER_ADDR');
}

const kingmakerAccounts = [deployer, feeCollector, lepidotteri, SHA_2048];

const config: HardhatUserConfig = {
	defaultNetwork: 'hardhat',
	networks: {
		hardhat: {
			blockGasLimit: 12500000,
			hardfork: 'muirGlacier',
			accounts: kingmakerAccounts,
			forking: {
				url: `https://eth-mainnet.alchemyapi.io/v2/${projectId}`,
				blockNumber: 11830510,
			},
			live: false,
			saveDeployments: true,
			tags: ['test', 'local'],
		},
		staging: {
			url: 'https://eth-ropsten.alchemyapi.io/v2/' + projectId,
			accounts: [deployerPK],
			live: true,
			saveDeployments: true,
			tags: ['staging'],
		},
		rinkeby: {
			url: 'https://eth-rinkeby.alchemyapi.io/v2/' + projectId,
			accounts: [deployerPK],
			live: true,
			saveDeployments: true,
			tags: ['staging'],
		},
		kovan: {
			url: 'https://eth-kovan.alchemyapi.io/v2/' + projectId,
			accounts: [deployerPK],
			live: true,
			saveDeployments: true,
			tags: ['staging'],
		},
		mainnet: {
			url: 'https://eth-mainnet.alchemyapi.io/v2/' + projectId,
			accounts: [deployerPK],
			live: true,
			saveDeployments: true,
			tags: ['production'],
		},
		localhost: {
			url: 'http://localhost:8545',
			live: false,
			saveDeployments: true,
			tags: ['local'],
		},
	},
	namedAccounts: {
		deployer: {
			default: 0, // here this will by default take the first account as deployer
			1: 0, // similarly on mainnet it will take the first account as deployer. Note though that depending on how hardhat network are configured, the account 0 on one network can be different than on another
			2: 0, // same on ropsten  (staging network)
			4: '0xFCCD70144337cCEF521C3677A46eD3525e91cc27', // but for rinkeby it will be a specific address
			kovan: '0xFCCD70144337cCEF521C3677A46eD3525e91cc27', //it can also specify a specific netwotk name (specified in hardhat.config.js)
		},
		lepidotteri: {
			default: 1, // here this will by default take the first account as deployer
		},
		SHA_2048: {
			default: 2, // here this will by default take the first account as deployer
		},
		feeCollector: {
			default: 3, // here this will, by default, take the second account as feeCollector (so in the test this will be a different account than the deployer)
			1: '0x09ba909BF9de148952B12c27d3f754fab36aa542', // on the mainnet the feeCollector could be (e.g.) a multi sig
			4: '0x09ba909BF9de148952B12c27d3f754fab36aa542', // on rinkeby it might as well be another account
		},
	},
	solidity: {
		compilers: [
			{
				version: '0.5.15',
				settings: {},
			},
			{
				version: '0.8.1',
				settings: {},
			},
		],
	},
	mocha: {
		timeout: 100000,
	},
	paths: {
		deploy: './deploy',
		deployments: './deployments',
		imports: `./imports`,
		sources: './contracts',
		tests: './test',
		cache: './cache',
		artifacts: './artifacts',
	},
	// typechain: {
	//     // outDir: "src/types",
	//     target: "ethers-v5",
	// },
	// @ts-ignore
	gasReporter: {
		currency: 'EUR',
		coinmarketcap: process.env.CMC_API_KEY || undefined,
		enabled: !!process.env.REPORT_GAS,
		showTimeSpent: true,
	},
	// tenderly: {
	//   username: TENDERLY_USERNAME,
	//   project: TENDERLY_PROJECT_NAME
	// },
};

export default config;
