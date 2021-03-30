import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-ethers';
import 'hardhat-deploy';
import 'hardhat-deploy-ethers';
// import "hardhat-typechain";
import 'hardhat-log-remover';
import 'hardhat-gas-reporter';
import "hardhat-contract-sizer";
import 'solidity-coverage';
// import "@tenderly/hardhat-tenderly"

import { HardhatUserConfig, task } from 'hardhat/config';
import 'dotenv/config';
import { getEnv, kingmakerAccounts, realAccounts } from './libs/config';

// REQUIRED TO ENSURE METADATA IS SAVED IN DEPLOYMENTS (because solidity-coverage disable it otherwise)
import { TASK_COMPILE_SOLIDITY_GET_COMPILER_INPUT } from 'hardhat/builtin-tasks/task-names';

task(TASK_COMPILE_SOLIDITY_GET_COMPILER_INPUT).setAction(async (_, bre, runSuper) => {
	const input = await runSuper();
	input.settings.metadata.useLiteralContent = bre.network.name !== 'coverage';
	return input;
});

const config: HardhatUserConfig = {
	defaultNetwork: 'hardhat',
	networks: {
		hardhat: {
			blockGasLimit: 9500000,
			allowUnlimitedContractSize: false,
			hardfork: 'muirGlacier',
			accounts: kingmakerAccounts,
			forking: {
				url: `https://eth-mainnet.alchemyapi.io/v2/${getEnv('ALCHEMY_PROJECT_ID')}`,
				blockNumber: 12121212,
			},
			live: false,
			saveDeployments: true,
			tags: ['test', 'local'],
		},
		localhost: {
			url: 'http://localhost:8545',
			live: false,
			saveDeployments: true,
			tags: ['local'],
		},
		rinkeby: {
			url: 'https://eth-rinkeby.alchemyapi.io/v2/' + getEnv('ALCHEMY_PROJECT_ID'),
			accounts: realAccounts,
			live: true,
			saveDeployments: true,
			tags: ['staging'],
		},
		mainnet: {
			url: 'https://eth-mainnet.alchemyapi.io/v2/' + getEnv('ALCHEMY_PROJECT_ID'),
			accounts: realAccounts,
			live: true,
			saveDeployments: true,
			tags: ['production'],
		},
	},
	namedAccounts: {
		deployer: {
			default: 0, // here this will by default take the first account as deployer
			0: 0, // similarly on mainnet it will take the first account as deployer. Note though that depending on how hardhat network are configured, the account 0 on one network can be different than on another
			4: 0, // same on rinkeby
			localhost: '0xfEeDc0DE1EBE0A72f52590Df786101e1c3944545', // it can also specify the network name and literal address
		},
		lepidotteri: {
			default: 1, // will by default take the second account
			mainnet: 1,
			4: 1,
		},
		SHA_2048: {
			default: 2, // will by default take the third account
			0: 2,
			rinkeby: 2,
		},
		feeCollector: {
			default: 3, // here this will, by default, take the fourth account
			rinkeby: 3, // on rinkeby it must be the same account as well
		},
		Treasury: {
			default: 8,
		},
		King: {
			default: 9,
		},
	},
	solidity: {
		compilers: [
			{
				version: '0.5.15',
				settings: {
					optimizer: {
						enabled: false,
						runs: 200,
					},
				},
			},
			{
				version: '0.7.6',
				settings: {
					optimizer: {
						enabled: false,
						runs: 200,
					},
				},
			},
			{
				version: '0.8.3',
				settings: {
					optimizer: {
						enabled: false,
						runs: 1000,
					},
				},
			},
		],
	},
	mocha: {
		timeout: 100000,
	},
	paths: {
		artifacts: './artifacts',
		cache: './cache',
		deploy: './deploy',
		deployments: './deployments',
		imports: `./imports`,
		sources: './contracts',
		tests: './test',
		// @ts-ignore
		coverage: './coverage',
		coverageJson: './coverage.json',
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
	// @ts-ignore
	contractSizer: {
		alphaSort: true,
		runOnCompile: true,
		disambiguatePaths: false,
	},
	// tenderly: {
	//   username: TENDERLY_USERNAME,
	//   project: TENDERLY_PROJECT_NAME
	// },
};

export default config;
