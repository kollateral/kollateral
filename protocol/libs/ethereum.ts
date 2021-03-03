// eslint-disable @typescript-eslint/ban-ts-comment
// @ts-ignore
import { ethers } from 'hardhat';
import { BigNumber, Contract } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { BigNumberish } from '@ethersproject/bignumber';
import { Address } from 'hardhat-deploy/dist/types';

export const O_Address = '0x0000000000000000000000000000000000000000';
export const zeroAddress = '0x0000000000000000000000000000000000000000';

export const tenPow18 = BigNumber.from(10).pow(18);

export async function getLatestBlock(): Promise<any> {
	return await ethers.provider.send('eth_getBlockByNumber', ['latest', false]);
}

export async function getLatestBlockTimestamp(): Promise<number> {
	return parseInt((await getLatestBlock()).timestamp);
}

export async function setNextBlockTimestamp(timestamp: number): Promise<void> {
	const block = await ethers.provider.send('eth_getBlockByNumber', ['latest', false]);
	const currentTs = parseInt(block.timestamp);
	const diff = timestamp - currentTs;
	await ethers.provider.send('evm_increaseTime', [diff]);
}

export async function moveAtTimestamp(timestamp: number): Promise<void> {
	await setNextBlockTimestamp(timestamp);
	await ethers.provider.send('evm_mine', []);
}

export async function contractAt(name: string, address: string): Promise<Contract> {
	return await ethers.getContractAt(name, address);
}

export const EIP712_DOMAIN_TYPEHASH = ethers.utils.keccak256(
	ethers.utils.toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
);

// = keccak256("1");
const EIP712_VERSION_HASH = '0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6';

export function getEIP712DomainSeparator(domainName: string, verifier: string): string {
	return ethers.utils.keccak256(
		ethers.utils.defaultAbiCoder.encode(
			['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
			[
				EIP712_DOMAIN_TYPEHASH,
				ethers.utils.keccak256(ethers.utils.toUtf8Bytes(domainName)),
				EIP712_VERSION_HASH, // OR ethers.utils.keccak256(ethers.utils.toUtf8Bytes('1')),
				ethers.provider.network.chainId,
				verifier,
			]
		)
	);
}

const PERMIT_TYPEHASH = ethers.utils.keccak256(
	ethers.utils.toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
);

export function getEIP712PermitDigest(
	domainSeparator: string,
	owner: Address,
	spender: Address,
	value: BigNumberish,
	nonce: BigNumberish,
	deadline: BigNumberish
): string {
	return ethers.utils.keccak256(
		ethers.utils.solidityPack(
			['bytes1', 'bytes1', 'bytes32', 'bytes32'],
			[
				'0x19',
				'0x01',
				domainSeparator,
				ethers.utils.keccak256(
					ethers.utils.defaultAbiCoder.encode(
						['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
						[PERMIT_TYPEHASH, owner, spender, value, nonce, deadline]
					)
				),
			]
		)
	);
}

const TRANSFER_WITH_AUTHORIZATION_TYPEHASH = ethers.utils.keccak256(
	ethers.utils.toUtf8Bytes(
		'TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)'
	)
);

export function getEIP712TransferWithAuthDigest(
	domainSeparator: string,
	from: Address,
	to: Address,
	value: BigNumberish,
	validAfter: BigNumberish,
	validBefore: BigNumberish,
	nonce: BigNumberish
): string {
	return ethers.utils.keccak256(
		ethers.utils.solidityPack(
			['bytes1', 'bytes1', 'bytes32', 'bytes32'],
			[
				'0x19',
				'0x01',
				domainSeparator,
				ethers.utils.keccak256(
					ethers.utils.defaultAbiCoder.encode(
						['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256', 'uint256'],
						[TRANSFER_WITH_AUTHORIZATION_TYPEHASH, from, to, value, validAfter, validBefore, nonce]
					)
				),
			]
		)
	);
}

const RECEIVE_WITH_AUTHORIZATION_TYPEHASH = ethers.utils.keccak256(
	ethers.utils.toUtf8Bytes(
		'ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)'
	)
);

export function getEIP712ReceiveWithAuthDigest(
	domainSeparator: string,
	from: Address,
	to: Address,
	value: BigNumberish,
	validAfter: BigNumberish,
	validBefore: BigNumberish,
	nonce: BigNumberish
): string {
	return ethers.utils.keccak256(
		ethers.utils.solidityPack(
			['bytes1', 'bytes1', 'bytes32', 'bytes32'],
			[
				'0x19',
				'0x01',
				domainSeparator,
				ethers.utils.keccak256(
					ethers.utils.defaultAbiCoder.encode(
						['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256', 'uint256'],
						[RECEIVE_WITH_AUTHORIZATION_TYPEHASH, from, to, value, validAfter, validBefore, nonce]
					)
				),
			]
		)
	);
}
