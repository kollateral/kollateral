import { Address } from 'hardhat-deploy/dist/types';
import { BigNumberish } from '@ethersproject/bignumber';

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
