import "@nomiclabs/hardhat-waffle";
// import "hardhat-typechain";

import { HardhatUserConfig } from "hardhat/config";

require('dotenv').config();
if(!process.env.KINGMAKER_PROJECT_ID || !process.env.KINGMAKER_PRIVATE_KEY) {
    throw Error('A /protocol/.env file with $KINGMAKER_PROJECT_ID and $KINGMAKER_PRIVATE_KEY set in it is needed');
}
const projectId = process.env.KINGMAKER_PROJECT_ID;
const privateKey = process.env.KINGMAKER_PRIVATE_KEY || '0x';

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