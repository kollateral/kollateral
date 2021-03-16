import { Address, Deployment } from 'hardhat-deploy/dist/types';
import { BigNumberish } from '@ethersproject/bignumber';
import { ethers, deployments, getNamedAccounts, network } from 'hardhat';
// @ts-ignore
import { ecsign } from 'ethereumjs-util';

import { greenBright, magenta } from 'colorette';

import { getEnv } from '../config';
import { getEIP712DomainSeparator, getEIP712PermitDigest } from '../ethereum';

const KINGMAKER_DEPLOYER_PK = getEnv('KINGMAKER_DEPLOYER_PK') || '0x';

export enum GrantClass {
	TEAM,
	VESTING,
	UNLOCKED,
}

export type Grant = {
	recipient: Address;
	amount: BigNumberish;
	class: GrantClass;
};

export type GrantCollection = {
	[network: string]: Grant[];
};

export const grantees: GrantCollection = {
	hardhat: [
		{
			recipient: '0x0A26a1eBca217c8090f9a7759Ef82f19a1E19ea1', // lepidotteri
			amount: 900, // 1%
			class: GrantClass.TEAM,
		},
		{
			recipient: '0x67D59BAEE903898AE507460aEc3D9442927f74ab', // Jester
			amount: 36.5,
			class: GrantClass.UNLOCKED,
		},
		{
			recipient: '0x09ba909BF9de148952B12c27d3f754fab36aa542', // Peasant
			amount: 0.9,
			class: GrantClass.UNLOCKED,
		},
		{
			recipient: '0x5736795e2AC2109970E28556a951E880cfcDFe89', // Treasury
			amount: 4500, // 5%
			class: GrantClass.VESTING,
		},
	],
	rinkeby: [
		{
			recipient: '0x0A26a1eBca217c8090f9a7759Ef82f19a1E19ea1',
			amount: 900, // 1%
			class: GrantClass.TEAM,
		},
		{
			recipient: '0x67D59BAEE903898AE507460aEc3D9442927f74ab',
			amount: 36.5,
			class: GrantClass.UNLOCKED,
		},
		{
			recipient: '0x09ba909BF9de148952B12c27d3f754fab36aa542',
			amount: 0.9,
			class: GrantClass.UNLOCKED,
		},
		{
			recipient: '0x5736795e2AC2109970E28556a951E880cfcDFe89',
			amount: 4500, // 5%
			class: GrantClass.VESTING,
		},
	],
};

export async function addGrants(startTime: number): Promise<void> {
	const { log } = deployments;
	let vestingDurationInDays = 0;
	let vestingCliffInDays = 0;
	let vestingPercentage = 0;

	const grants = grantees[network.name];
	const clergy = await deployments.read('Monastery', 'clergy');
	const decimals = await deployments.read('KING', 'decimals');
	const decimalMultiplier = ethers.BigNumber.from(10).pow(decimals);
	let index = 0;
	for (const grant of grants) {
		if (grant.class === GrantClass.VESTING) {
			vestingDurationInDays = 180;
			vestingCliffInDays = 0;
			vestingPercentage = 75;
		} else if (grant.class === GrantClass.TEAM) {
			vestingDurationInDays = 730;
			vestingCliffInDays = 180;
			vestingPercentage = 100;
		} else if (grant.class === GrantClass.UNLOCKED) {
			continue;
		}

		const totalTokenAllocation = ethers.BigNumber.from(parseInt(String(grant.amount)) * 100)
			.mul(decimalMultiplier)
			.div(100);
		const grantAmount = totalTokenAllocation.mul(vestingPercentage).div(100);
		log(
			`   - Creating grant for ${magenta(grant.recipient)} (class: ${
				grant.class
			}) - Total allocation: ${totalTokenAllocation}, Grant amount: ${grantAmount}`
		);

		await deployments.execute(
			'Monastery',
			{ from: clergy, gasLimit: 6666666 },
			'addTokenGrant',
			grant.recipient,
			startTime,
			grantAmount,
			vestingDurationInDays,
			vestingCliffInDays
		);

		const newGrant = await deployments.read('Monastery', 'getTokenGrant', grant.recipient);
		log(`      ${++index}. New grant created for ${magenta(grant.recipient)}:`);
		log(`         - Start Time: ${newGrant[0]}`);
		log(`         - Amount: ${newGrant[1]}`);
		log(`         - Duration: ${newGrant[2]}`);
		log(`         - Cliff: ${newGrant[3]}`);
	}
}

export async function distributeUnlockedTokens(): Promise<void> {
	const { log } = deployments;
	const { deployer } = await getNamedAccounts();

	const Multisend = await deployments.get('Multisend');
	const KING = await deployments.get('KING');
	const tokenName = await deployments.read('KING', 'name');

	const decimals = await deployments.read('KING', 'decimals');
	const decimalMultiplier = ethers.BigNumber.from(10).pow(decimals);

	const grants = grantees[network.name];
	const recipients = [];
	const amounts = [];
	let totalNumUnlockedTokens = ethers.BigNumber.from(0);
	let unlockedPercentage = 0;
	for (const grant of grants) {
		if (grant.class == GrantClass.VESTING) {
			unlockedPercentage = 25;
		} else if (grant.class == GrantClass.UNLOCKED) {
			unlockedPercentage = 100;
		} else {
			continue;
		}
		const totalTokenAllocation = ethers.BigNumber.from(parseInt(String(grant.amount)) * 100)
			.mul(decimalMultiplier)
			.div(100);
		const unlockedAmount = totalTokenAllocation.mul(unlockedPercentage).div(100);
		recipients.push(grant.recipient);
		amounts.push(unlockedAmount);
		totalNumUnlockedTokens = totalNumUnlockedTokens.add(unlockedAmount);
		log(
			`   - Distributing ${greenBright(unlockedAmount.div(decimalMultiplier).toString())} unlocked KING tokens to ${magenta(
				grant.recipient
			)}`
		);
	}

	const domainSeparator = getEIP712DomainSeparator(tokenName, KING.address);
	const nonce = await deployments.read('KING', 'nonces', deployer);
	// Deadline for distributing tokens = now + 20 minutes
	const deadline = parseInt(String(Date.now() / 1000)) + 1200;
	const digest = getEIP712PermitDigest(domainSeparator, deployer, Multisend.address, totalNumUnlockedTokens, nonce, deadline);
	const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(KINGMAKER_DEPLOYER_PK, 'hex'));

	const result = await deployments.execute(
		'Multisend',
		{ from: deployer, gasLimit: 8421000 },
		'batchTransferWithPermit',
		totalNumUnlockedTokens,
		recipients,
		amounts,
		deadline,
		v,
		r,
		s
	);
	if (result.status === 1) {
		log(`   - Distributed  ${greenBright(totalNumUnlockedTokens.div(decimalMultiplier).toString())} unlocked KING tokens`);
	} else {
		log(`   - There was an issue distributing unlocked KING tokens`);
		log(result);
	}
}
