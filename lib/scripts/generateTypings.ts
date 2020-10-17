const shell = require('shelljs');

shell.cd('../protocol');
shell.exec('yarn compile');
shell.cd('../lib');
shell.exec('rimraf abi');
shell.cp('-R', '../protocol/artifacts', 'abi');
shell.exec('rimraf generated');
shell.exec('node ../node_modules/typechain/dist/cli/cli.js ' +
    '--target web3-v2 ' +
    '--outDir ./lib/generated "abi/@(Invoker|KEther|KErc20|KToken|ERC20|TestToken).json"'
);
