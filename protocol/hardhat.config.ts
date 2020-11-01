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

const projectId = getEnv("KINGMAKER_PROJECT_ID") || '0xDEAD';
const privateKey = getEnv("KINGMAKER_PRIVATE_KEY") || '0xDEAD';

if (projectId === undefined || projectId === "0xDEAD") {
    printWarning('KINGMAKER_PROJECT_ID');
}
if (privateKey === undefined || privateKey === "0xDEAD") {
    printWarning('KINGMAKER_PRIVATE_KEY');
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
            accounts: [ privateKey ]
        },
        ropsten: {
            url: "https://eth-ropsten.alchemyapi.io/v2/" + projectId,
            accounts: [ privateKey ]
        },
        kovan: {
            url: "https://eth-kovan.alchemyapi.io/v2/" + projectId,
            accounts: [ privateKey ]
        },
        mainnet: {
            url: "https://eth-mainnet.alchemyapi.io/v2/" + projectId,
            accounts: [ privateKey ]
        }
    },
    solidity: {
        compilers: [
            {
                version: "0.5.15"
            },
            {
                version: "0.7.0",
                settings: { }
            }
        ]
    },
    // typechain: {
    //     // outDir: "src/types",
    //     target: "ethers-v5",
    // },
};

export default config;