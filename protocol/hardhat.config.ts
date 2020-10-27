import "@nomiclabs/hardhat-waffle";
import { HardhatUserConfig } from "hardhat/config";

require('dotenv').config();
const projectId = process.env.KINGMAKER_PROJECT_ID;
const privateKey = process.env.KINGMAKER_PRIVATE_KEY || '0x';

const config: HardhatUserConfig = {
    networks: {
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
    }
};

export default config;