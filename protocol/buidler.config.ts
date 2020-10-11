import { BuidlerConfig, usePlugin } from "@nomiclabs/buidler/config";

usePlugin("@nomiclabs/buidler-waffle");
// usePlugin("@nomiclabs/buidler-truffle5");

require('dotenv').config();
const projectId = process.env.KINGMAKER_PROJECT_ID;
const privateKey = process.env.KINGMAKER_PRIVATE_KEY || '0x';

// You have to export an object to set up your config
// This object can have the following optional entries:
// defaultNetwork, networks, solc, and paths.
// Go to https://buidler.dev/config/ to learn more
const config: BuidlerConfig = {
  defaultNetwork: "buidlerevm",
  networks: {
    buidlerevm: {
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
    goerli: {
      url: "https://eth-goerli.alchemyapi.io/v2/" + projectId,
      accounts: [ privateKey ]
    },
    mainnet: {
      url: "https://eth-mainnet.alchemyapi.io/v2/" + projectId,
      accounts: [ privateKey ]
    }
  },
  solc: {
    version: "0.5.16",
    optimizer: {
      enabled: false,
      runs: 200
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};

export default config;
