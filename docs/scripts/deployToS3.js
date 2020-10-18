require('dotenv').config();

const shell = require('shelljs');

shell.exec('rimraf .docz');
shell.exec('yarn build')
shell.exec('deploy-aws-s3-cloudfront ' +
    '--non-interactive ' +
    '--delete ' +
    '--bucket "docs.kingmaker.dev" ' +
    '--source ".docz/public/" ' +
    '--cache-control "index.html:no-cache" ' +
    '--distribution "E2VO1OLJVX18LA"')
