import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
// import "hardhat-typechain";

import { extendEnvironment, HardhatUserConfig } from "hardhat/config";

import chalk from "chalk";

require('dotenv').config();
function getEnv(key: string): string | undefined {
    const variable = process.env[key];
    if (variable === undefined) {
        return undefined;
    }
    return variable.trim();
}
function printWarning(envVar: string) {
    console.warn(
        chalk.bgYellowBright.blackBright.bold(`TEST RUN INCOMPLETE: Set the env variable ${envVar} in /protocol/.env`)
    );
}

const projectId = getEnv("ALCHEMY_PROJECT_ID") || '0xDEAD';
const deployerPK = getEnv("KINGMAKER_DEPLOYER_PK") || '0xDEAD';
const deployerAddr = getEnv("KINGMAKER_DEPLOYER_ADDR") || '0xDEAD';

if (projectId === undefined || projectId === "0xDEAD") {
    printWarning('ALCHEMY_PROJECT_ID');
}
if (deployerPK === undefined || deployerPK === "0xDEAD") {
    printWarning('KINGMAKER_DEPLOYER_PK');
}
if (deployerAddr === undefined || deployerAddr === "0xDEAD") {
    printWarning('KINGMAKER_DEPLOYER_ADDR');
}

const config: HardhatUserConfig = {
    networks: {
        hardhat: {
            forking: {
                url: `https://eth-mainnet.alchemyapi.io/v2/${projectId}`,
                blockNumber: 11155111
            }
        },
        rinkeby: {
            url: "https://eth-rinkeby.alchemyapi.io/v2/" + projectId,
            accounts: [ deployerPK ]
        },
        ropsten: {
            url: "https://eth-ropsten.alchemyapi.io/v2/" + projectId,
            accounts: [ deployerPK ]
        },
        kovan: {
            url: "https://eth-kovan.alchemyapi.io/v2/" + projectId,
            accounts: [ deployerPK ]
        },
        mainnet: {
            url: "https://eth-mainnet.alchemyapi.io/v2/" + projectId,
            accounts: [ deployerPK ]
        }
    },
    solidity: {
        compilers: [
            {
                version: "0.5.15",
                settings: {}
            },
            {
                version: "0.8.1",
                settings: {}
            }
        ]
    },
    // typechain: {
    //     // outDir: "src/types",
    //     target: "ethers-v5",
    // },
};

export default config;
