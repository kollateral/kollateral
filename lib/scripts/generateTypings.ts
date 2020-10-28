const shell = require('shelljs');

shell.cd('../protocol');
shell.exec('yarn clean');
shell.exec('yarn compile');

shell.cd('../lib');
shell.exec('yarn clean');

shell.mkdir('protocol');
shell.cp('-R', '../protocol/artifacts', 'protocol/artifacts');
shell.cp('-R', '../protocol/typechain', 'protocol/typechain');
