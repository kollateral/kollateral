import {Address, Deployment} from 'hardhat-deploy/dist/types';
import { BigNumberish } from '@ethersproject/bignumber';
import { ethers, deployments, network } from 'hardhat';
import {magenta} from "colorette";

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
			amount: 900,
			class: GrantClass.TEAM,
		},
		{
			recipient: '0xDFC11e479e2fd622fa49C06dA76bdE32B3A47322', // King
			amount: 9000,
			class: GrantClass.VESTING,
		},
		{
			recipient: '0x67D59BAEE903898AE507460aEc3D9442927f74ab', // Jester
			amount: 365,
			class: GrantClass.UNLOCKED,
		},
		{
			recipient: '0x09ba909BF9de148952B12c27d3f754fab36aa542', // Peasant
			amount: 10,
			class: GrantClass.UNLOCKED,
		},
	],
	rinkeby: [
		{
			recipient: '0x0A26a1eBca217c8090f9a7759Ef82f19a1E19ea1', // lepidotteri
			amount: 900,
			class: GrantClass.TEAM,
		},
		{
			recipient: '0xDFC11e479e2fd622fa49C06dA76bdE32B3A47322', // King
			amount: 9000,
			class: GrantClass.VESTING,
		},
		{
			recipient: '0x67D59BAEE903898AE507460aEc3D9442927f74ab', // Jester
			amount: 365,
			class: GrantClass.UNLOCKED,
		},
		{
			recipient: '0x09ba909BF9de148952B12c27d3f754fab36aa542', // Peasant
			amount: 10,
			class: GrantClass.UNLOCKED,
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
	const balanceOfClergy = await deployments.read('KING', 'balanceOf', clergy);
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
			`   - Creating grant for ${magenta(grant.recipient)} (class: ${grant.class}) - Total allocation: ${totalTokenAllocation}, Grant amount: ${grantAmount}`
		);

		const Monastery: Deployment = await deployments.get('Monastery');
		// first, allow Monastery to tranfer token from deployer to grantee
		await deployments.execute('KING', { from: clergy }, 'approve', Monastery.address, grantAmount);
		// then transfer
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
