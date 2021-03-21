import chalk from 'chalk';

export function getEnv(key: string): string | undefined {
	const variable = process.env[key];
	if (variable === undefined) {
		printWarning(key);
		return undefined;
	}
	return variable.trim();
}

export function printWarning(env: string): void {
	console.warn(chalk.bold.yellowBright.bgBlackBright(`TEST RUN INCOMPLETE: Set the env variable ${env} in /protocol/.env`));
}

const deployerPK = getEnv('KINGMAKER_DEPLOYER_PK') || '0xDEAD';

const deployer = {
	privateKey: deployerPK,
	balance: '10000000000000000000000',
};
const lepidotteri = {
	privateKey: '0xd0f1f5f4bd9f4b990240a689d568abd1d5f2a1e6b6d220b86d66891722e5313a', // addr: 0x0A26a1eBca217c8090f9a7759Ef82f19a1E19ea1
	balance: '10000000000000000000000',
};
const SHA_2048 = {
	privateKey: '0x1febd0c69f2138a7dcedd7d9d6e481b6eb2a607c205905a47f77fcd7bf0f599e', // addr: 0x0E041eDB5CFe0e053B051a56773356aBeb101Be4
	balance: '10000000000000000000000',
};
const feeCollector = {
	privateKey: '0x20d6a8528d88ef310a4042f7372daaca37448c9805fcfb4807fc230d027e57fd', // addr: 0x5Edc1d928efDDd29A79c81676B9B8D4D6C3b6a09
	balance: '10000000000000000000000',
};
const King = {
	privateKey: '0xb1115fcf87e5bf9a3620db09053b78270f699c8537405090c80c84cfdcac6685', // addr: 0xDFC11e479e2fd622fa49C06dA76bdE32B3A47322
	balance: '1000000000000000000000000',
};
const Bishop = {
	privateKey: '0x65a8a634656995f95195629229d4f958fb3f03321419e52a563990bb0ef8102f', // addr: 0x951B9C8caAD54Ca6c6A3bCbFf0807fC73DEd066b
	balance: '100000000000000000000000',
};
const Jester = {
	privateKey: '0xee0d247af69b47f59def617c0ad167e51ad1af5f703f4eac8fa86a2de4d2812d', // addr: 0x67D59BAEE903898AE507460aEc3D9442927f74ab
	balance: '10000000000000000000000',
};
const Dragon = {
	privateKey: '0x7a9b9d4e8e0c3943ac88eeaca9df83325a23634af035102b3b4c8f6d1f34ac7a', // addr: 0xE99b0142Ec4D62f3dD5dcd1425c838B6Df67c082
	balance: '10000000000000000000000000',
};
const Peasant = {
	privateKey: '0x547c0b03b0988e67bf0557c3bf0230b03e83e481e3047ba63a96660ca79cbaa1', // addr: 0x09ba909BF9de148952B12c27d3f754fab36aa542
	balance: '10000000000000000000000',
};

export const kingmakerAccounts = [deployer, lepidotteri, SHA_2048, feeCollector, King, Bishop, Jester, Dragon, Peasant];
export const realAccounts = [
	deployer.privateKey,
	lepidotteri.privateKey,
	SHA_2048.privateKey,
	feeCollector.privateKey,
	King.privateKey,
	Bishop.privateKey,
	Jester.privateKey,
	Dragon.privateKey,
	Peasant.privateKey,
];
