npm run copy-abis
rm -rf generated
node_modules/typechain/dist/cli/cli.js --target web3-v2 --outDir generated 'abi/@(Invoker|KEther|KErc20|KToken|ERC20|TestToken).json'