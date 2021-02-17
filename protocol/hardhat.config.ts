import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-ethers';
import 'hardhat-deploy';
import 'hardhat-deploy-ethers';
// import "hardhat-typechain";
import 'hardhat-log-remover';
import 'hardhat-gas-reporter';
import 'solidity-coverage';
// import "@tenderly/hardhat-tenderly"

import { HardhatUserConfig } from 'hardhat/config';
import 'dotenv/config';
import { getEnv, printWarning } from './libs/hardhat/ConfigUtils';

const projectId = getEnv('ALCHEMY_PROJECT_ID') || '0xFEAD';
const deployerPK = getEnv('KINGMAKER_DEPLOYER_PK') || '0xDEAD';
const deployerAddr = getEnv('KINGMAKER_DEPLOYER_ADDR') || '0xC0DE';

if (projectId === undefined || projectId === '0xFEAD') {
	printWarning('ALCHEMY_PROJECT_ID');
}
if (deployerPK === undefined || deployerPK === '0xDEAD') {
	printWarning('KINGMAKER_DEPLOYER_PK');
}
if (deployerAddr === undefined || deployerAddr === '0xC0DE') {
	printWarning('KINGMAKER_DEPLOYER_ADDR');
}

const deployer = {
	privateKey: deployerPK,
	balance: '10000000000000000000000',
};
const lepidotteri = {
	privateKey: '0xd0f1f5f4bd9f4b990240a689d568abd1d5f2a1e6b6d220b86d66891722e5313a', // addr: 0x0A26a1eBca217c8090f9a7759Ef82f19a1E19ea1
	balance: '10000000000000000000000',
};
const SHA_2048 = {
	privateKey: '0x1febd0c69f2138a7dcedd7d9d6e481b6eb2a607c205905a47f77fcd7bf0f599e', // addr: 0x0E041eDB5CFe0e053B051a56773356aBeb101Be4
	balance: '10000000000000000000000',
};
const feeCollector = {
	privateKey: '0x547c0b03b0988e67bf0557c3bf0230b03e83e481e3047ba63a96660ca79cbaa1', // addr: 0x09ba909BF9de148952B12c27d3f754fab36aa542
	balance: '10000000000000000000000',
};

const kingmakerAccounts = [deployer, lepidotteri, SHA_2048, feeCollector];

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
			accounts: [deployer.privateKey, lepidotteri.privateKey, SHA_2048.privateKey, feeCollector.privateKey],
			live: true,
			saveDeployments: true,
			tags: ['staging'],
		},
		rinkeby: {
			url: 'https://eth-rinkeby.alchemyapi.io/v2/' + projectId,
			accounts: [deployer.privateKey, lepidotteri.privateKey, SHA_2048.privateKey, feeCollector.privateKey],
			live: true,
			saveDeployments: true,
			tags: ['staging'],
		},
		kovan: {
			url: 'https://eth-kovan.alchemyapi.io/v2/' + projectId,
			accounts: [deployer.privateKey, lepidotteri.privateKey, SHA_2048.privateKey, feeCollector.privateKey],
			live: true,
			saveDeployments: true,
			tags: ['staging'],
		},
		mainnet: {
			url: 'https://eth-mainnet.alchemyapi.io/v2/' + projectId,
			accounts: [deployer.privateKey, lepidotteri.privateKey, SHA_2048.privateKey, feeCollector.privateKey],
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
			0: 0, // similarly on mainnet it will take the first account as deployer. Note though that depending on how hardhat network are configured, the account 0 on one network can be different than on another
			1: 0, // same on ropsten  (staging network)
			4: 0, // but for rinkeby it will be a specific address
			kovan: '0xfEeDc0DE1EBE0A72f52590Df786101e1c3944545', // it can also specify the network name and literal address
		},
		lepidotteri: {
			default: 1, // will by default take the second account
			0: 1,
			1: 1,
			4: 1,
			kovan: 1,
		},
		SHA_2048: {
			default: 2, // will by default take the third account
			0: 2,
			1: 2,
			rinkeby: 2,
			kovan: 2,
		},
		feeCollector: {
			default: 3, // here this will, by default, take the fourth account
			1: 3, // on the mainnet the feeCollector could be (e.g.) a multi sig
			2: 3,
			4: 3, // on rinkeby it might as well be the same account
			kovan: 3,
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
