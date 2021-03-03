import * as fs from 'fs';

import { expect } from 'chai';
import { ethers, network } from 'hardhat';
import { ecsign } from 'ethereumjs-util';

import { governanceFixture } from '../fixtures';
import { getEnv } from '../../libs/ConfigUtils';
import { Contract } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {getEIP712DomainSeparator, getEIP712PermitDigest} from "../../libs/EthereumUtils";

const KINGMAKER_DEPLOYER_PK = getEnv('KINGMAKER_DEPLOYER_PK') || '0x';

const PERMIT_TYPEHASH = ethers.utils.keccak256(
	ethers.utils.toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
);

describe('VotingPower', () => {
	let govToken: Contract;
	let vesting: Contract;
	let votingPower: Contract;
	let votingPowerPrism: Contract;
	let votingPowerImplementation: Contract;

	let deployer: SignerWithAddress;
	let admin: SignerWithAddress;
	let lepidotteri: SignerWithAddress;
	let SHA_2048: SignerWithAddress;

	let ZERO_ADDRESS: string;

	beforeEach(async () => {
		const f = await governanceFixture();
		govToken = f.govToken;
		vesting = f.vesting;
		votingPower = f.votingPower;
		votingPowerPrism = f.votingPowerPrism;
		votingPowerImplementation = f.votingPowerImplementation;
		deployer = f.deployer;
		admin = f.admin;
		lepidotteri = f.lepidotteri;
		SHA_2048 = f.SHA_2048;
		ZERO_ADDRESS = f.ZERO_ADDRESS;
	});

	context('Pre-Init', async () => {
		context('govToken', async () => {
			it('reverts', async () => {
				await expect(votingPower.govToken()).to.reverted;
			});
		});
	});
	context('Post-Init', async () => {
		beforeEach(async () => {
			await votingPowerPrism.setPendingProxyImplementation(votingPowerImplementation.address);
			await votingPowerImplementation.become(votingPowerPrism.address);
			await votingPower.initialize(govToken.address, vesting.address);
		});
		context('govToken', async () => {
			it('returns the current ARCH token address', async () => {
				expect(await votingPower.govToken()).to.eq(govToken.address);
				expect(await votingPowerImplementation.govToken()).to.eq(ZERO_ADDRESS);
			});
		});

		context('decimals', async () => {
			it('returns the correct decimals for voting power', async () => {
				expect(await votingPower.decimals()).to.eq(18);
			});
		});

		context('vestingContract', async () => {
			it('returns the current vesting contract address', async () => {
				expect(await votingPower.vestingContract()).to.eq(vesting.address);
				expect(await votingPowerImplementation.vestingContract()).to.eq(ZERO_ADDRESS);
			});
		});

		context('stake', async () => {
			it('allows a valid stake', async () => {
				const userBalanceBefore = await govToken.balanceOf(deployer.address);
				const contractBalanceBefore = await govToken.balanceOf(votingPower.address);
				const totalArchStakedBefore = await votingPower.getARCHAmountStaked(deployer.address);
				const userVotesBefore = await votingPower.balanceOf(deployer.address);
				await govToken.approve(votingPower.address, 1000);
				await votingPower['stake(uint256)'](1000);
				expect(await govToken.balanceOf(deployer.address)).to.eq(userBalanceBefore.sub(1000));
				expect(await govToken.balanceOf(votingPower.address)).to.eq(contractBalanceBefore.add(1000));
				expect(await votingPower.getARCHAmountStaked(deployer.address)).to.eq(totalArchStakedBefore.add(1000));
				expect(await votingPower.balanceOf(deployer.address)).to.eq(userVotesBefore.add(1000));
			});

			it('does not allow a zero stake amount', async () => {
				await expect(votingPower['stake(uint256)'](0)).to.revertedWith('revert VP::stake: cannot stake 0');
			});

			it('does not allow a user to stake more tokens than they have', async () => {
				await expect(votingPower.connect(lepidotteri)['stake(uint256)'](1000)).to.revertedWith('revert VP::stake: not enough tokens');
			});

			it('does not allow a user to stake before approval', async () => {
				await expect(votingPower['stake(uint256)'](1000)).to.revertedWith('revert VP::stake: must approve tokens before staking');
			});
		});

		context('stakeWithPermit', async () => {
			it('allows a valid stake with permit', async () => {
				const value = 1000;
				const userBalanceBefore = await govToken.balanceOf(deployer.address);
				const contractBalanceBefore = await govToken.balanceOf(votingPower.address);
				const totalArchStakedBefore = await votingPower.getARCHAmountStaked(deployer.address);
				const userVotesBefore = await votingPower.balanceOf(deployer.address);
				const domainSeparator = getEIP712DomainSeparator(await govToken.name(), govToken.address);
				const nonce = await govToken.nonces(deployer.address);
				const deadline = ethers.constants.MaxUint256;
				const digest = getEIP712PermitDigest(domainSeparator, deployer.address, votingPower.address, value, nonce, deadline);
				const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(KINGMAKER_DEPLOYER_PK, 'hex'));

				await votingPower.stakeWithPermit(value, deadline, v, r, s);
				expect(await govToken.balanceOf(deployer.address)).to.eq(userBalanceBefore.sub(value));
				expect(await govToken.balanceOf(votingPower.address)).to.eq(contractBalanceBefore.add(value));
				expect(await votingPower.getARCHAmountStaked(deployer.address)).to.eq(totalArchStakedBefore.add(value));
				expect(await votingPower.balanceOf(deployer.address)).to.eq(userVotesBefore.add(value));
			});

			it('does not allow a zero stake amount', async () => {
				const value = 0;
				const domainSeparator = getEIP712DomainSeparator(await govToken.name(), govToken.address);

				const nonce = await govToken.nonces(deployer.address);
				const deadline = ethers.constants.MaxUint256;
				const digest = ethers.utils.keccak256(
					ethers.utils.solidityPack(
						['bytes1', 'bytes1', 'bytes32', 'bytes32'],
						[
							'0x19',
							'0x01',
							domainSeparator,
							ethers.utils.keccak256(
								ethers.utils.defaultAbiCoder.encode(
									['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
									[PERMIT_TYPEHASH, deployer.address, votingPower.address, value, nonce, deadline]
								)
							),
						]
					)
				);

				const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(KINGMAKER_DEPLOYER_PK, 'hex'));
				await expect(votingPower.stakeWithPermit(value, deadline, v, r, s)).to.revertedWith(
					'revert VP::stakeWithPermit: cannot stake 0'
				);
			});

			it('does not allow a user to stake using a permit signed by someone else', async () => {
				const value = 1000;
				const domainSeparator = getEIP712DomainSeparator(await govToken.name(), govToken.address);

				const nonce = await govToken.nonces(lepidotteri.address);
				const deadline = ethers.constants.MaxUint256;
				const digest = ethers.utils.keccak256(
					ethers.utils.solidityPack(
						['bytes1', 'bytes1', 'bytes32', 'bytes32'],
						[
							'0x19',
							'0x01',
							domainSeparator,
							ethers.utils.keccak256(
								ethers.utils.defaultAbiCoder.encode(
									['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
									[PERMIT_TYPEHASH, lepidotteri.address, votingPower.address, value, nonce, deadline]
								)
							),
						]
					)
				);

				const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(KINGMAKER_DEPLOYER_PK, 'hex'));
				await expect(votingPower.stakeWithPermit(value, deadline, v, r, s)).to.revertedWith(
					'revert Arch::validateSig: invalid signature'
				);
			});

			it('does not allow a user to stake more tokens than they have', async () => {
				const value = 1000;
				const domainSeparator = getEIP712DomainSeparator(await govToken.name(), govToken.address);
				const nonce = await govToken.nonces(lepidotteri.address);
				const deadline = ethers.constants.MaxUint256;
				const digest = ethers.utils.keccak256(
					ethers.utils.solidityPack(
						['bytes1', 'bytes1', 'bytes32', 'bytes32'],
						[
							'0x19',
							'0x01',
							domainSeparator,
							ethers.utils.keccak256(
								ethers.utils.defaultAbiCoder.encode(
									['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
									[PERMIT_TYPEHASH, lepidotteri.address, votingPower.address, value, nonce, deadline]
								)
							),
						]
					)
				);

				const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(KINGMAKER_DEPLOYER_PK, 'hex'));
				await expect(votingPower.connect(lepidotteri).stakeWithPermit(value, deadline, v, r, s)).to.revertedWith(
					'revert VP::stakeWithPermit: not enough tokens'
				);
			});
		});

		context('addVotingPowerForVestingTokens', async () => {
			it('does not allow user to add 0 voting power', async () => {
				await expect(votingPower.addVotingPowerForVestingTokens(lepidotteri.address, 0)).to.revertedWith(
					'revert VP::addVPforVT: cannot add 0 voting power'
				);
			});

			it('does not allow addresses other than the vesting contract to add voting power', async () => {
				await expect(votingPower.addVotingPowerForVestingTokens(lepidotteri.address, 1000)).to.revertedWith(
					'revert VP::addVPforVT: only vesting contract'
				);
			});
		});

		context('removeVotingPowerForClaimedTokens', async () => {
			it('does not allow user to remove 0 voting power', async () => {
				await expect(votingPower.removeVotingPowerForClaimedTokens(lepidotteri.address, 0)).to.revertedWith(
					'revert VP::removeVPforCT: cannot remove 0 voting power'
				);
			});

			it('does not allow addresses other than the vesting contract to remove voting power', async () => {
				await expect(votingPower.removeVotingPowerForClaimedTokens(lepidotteri.address, 1000)).to.revertedWith(
					'revert VP::removeVPforCT: only vesting contract'
				);
			});
		});

		context('withdraw', async () => {
			it('allows a valid withdrawal', async () => {
				const userBalanceBefore = await govToken.balanceOf(deployer.address);
				const contractBalanceBefore = await govToken.balanceOf(votingPower.address);
				const totalArchStakedBefore = await votingPower.getARCHAmountStaked(deployer.address);
				const userVotesBefore = await votingPower.balanceOf(deployer.address);
				await govToken.approve(votingPower.address, 1000);
				await votingPower['stake(uint256)'](1000);
				expect(await govToken.balanceOf(deployer.address)).to.eq(userBalanceBefore.sub(1000));
				expect(await govToken.balanceOf(votingPower.address)).to.eq(contractBalanceBefore.add(1000));
				expect(await votingPower.getARCHAmountStaked(deployer.address)).to.eq(totalArchStakedBefore.add(1000));
				const userVotesAfter = await votingPower.balanceOf(deployer.address);
				expect(userVotesAfter).to.eq(userVotesBefore.add(1000));
				await votingPower['withdraw(uint256)'](1000);
				expect(await govToken.balanceOf(deployer.address)).to.eq(userBalanceBefore);
				expect(await govToken.balanceOf(votingPower.address)).to.eq(contractBalanceBefore);
				expect(await votingPower.getARCHAmountStaked(deployer.address)).to.eq(totalArchStakedBefore);
				expect(await votingPower.balanceOf(deployer.address)).to.eq(0);
			});

			it('does not allow a zero withdrawal amount', async () => {
				await expect(votingPower['withdraw(uint256)'](0)).to.revertedWith('revert VP::withdraw: cannot withdraw 0');
			});

			it('does not allow a user to withdraw more than their current stake', async () => {
				await govToken.approve(votingPower.address, 1000);
				await votingPower['stake(uint256)'](1000);
				await expect(votingPower['withdraw(uint256)'](1001)).to.revertedWith('revert VP::_withdraw: not enough tokens staked');
			});

			it('does not allow a user to withdraw more than they have staked when they have vesting tokens', async () => {
				await govToken.approve(votingPower.address, 1000);
				await votingPower['stake(uint256)'](1000);
				await vesting.setVotingPowerContract(votingPower.address);
				await govToken.approve(vesting.address, ethers.constants.MaxUint256);
				const decimals = await govToken.decimals();
				const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
				const VESTING_DURATION_IN_DAYS = 4;
				const VESTING_CLIFF_IN_DAYS = 1;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));
				await vesting.addTokenGrant(deployer.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);
				await expect(votingPower['withdraw(uint256)'](2000)).to.revertedWith('revert VP::_withdraw: not enough tokens staked');
			});
		});
	});
});
