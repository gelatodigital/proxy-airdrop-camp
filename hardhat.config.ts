import { HardhatUserConfig } from "hardhat/config";

import "@gelatonetwork/web3-functions-sdk/hardhat-plugin";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomiclabs/hardhat-etherscan"
import "@typechain/hardhat";
import "hardhat-deploy";

import * as dotenv from "dotenv";
dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ETHERSCAN_KEY = process.env.ETHERSCAN_KEY;
const ALCHEMY_KEY  = process.env.ALCHEMY_KEY

const config: HardhatUserConfig = {
  w3f: {
    rootDir: "./web3-functions",
    debug: false,
    networks: ["baseSepolia"],
  },
  solidity: {
    compilers: [
      {
        version: "0.8.25",
        settings: {
          optimizer: { enabled: true, runs: 999999 },
          evmVersion: "paris",
        },
      },
    ],
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v6",
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  defaultNetwork:"hardhat",
  networks: {
    hardhat: {
      forking: {
        url: `https://rpc.camp.raas.gelato.cloud`,

      // blockNumber: 	24774417,
      },
    },
    camp: {
      chainId: 484,
      url: `https://rpc.camp.raas.gelato.cloud`,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },

  },

    etherscan: {
      apiKey:  { 
        camp:"AXX"
       
      },
      customChains: [
        {
          network: "camp",
          chainId: 484,
          urls: {
           apiURL: " https://camp.cloud.blockscout.com/api",
          browserURL: "https://camp.cloud.blockscout.com"
          }
            },
         
      ]
    },

};

export default config;
