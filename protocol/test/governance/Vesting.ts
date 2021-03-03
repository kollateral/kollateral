import { expect } from 'chai';
import { ethers, network } from 'hardhat';
import { Address } from 'hardhat-deploy/dist/types';
import { Contract } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import { governanceFixture } from '../fixtures';
import { Grant, grantees } from '../../libs/grants/utils';

async function sanityCheck_emptyGrant(vesting: Contract, address: Address) {
	const emptyGrant = await vesting.getTokenGrant(address);
	expect(emptyGrant[0]).to.eq(0);
	expect(emptyGrant[1]).to.eq(0);
	expect(emptyGrant[2]).to.eq(0);
	expect(emptyGrant[3]).to.eq(0);
	expect(emptyGrant[4]).to.eq(0);
}

describe('Vesting', () => {
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
		await votingPowerPrism.setPendingProxyImplementation(votingPowerImplementation.address);
		await votingPowerImplementation.become(votingPowerPrism.address);
	});

	context('Pre-init', async () => {
		context('setVotingPowerContract', async () => {
			it('reverts', async () => {
				await expect(vesting.setVotingPowerContract(votingPower.address)).to.revertedWith(
					'Vest::setVotingPowerContract: voting power not initialized'
				);
			});
		});
	});

	context('Post-init', async () => {
		beforeEach(async () => {
			await votingPower.initialize(govToken.address, vesting.address);
		});

		context('addGrant', async () => {
			it('creates valid grant', async () => {
				const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_CLIFF_IN_DAYS = 1;
				await vesting.setVotingPowerContract(votingPower.address);
				await govToken.approve(vesting.address, ethers.constants.MaxUint256);
				const decimals = await govToken.decimals();
				let totalVested = await govToken.balanceOf(vesting.address);
				const userVotesBefore = await votingPower.votingPowerOf(lepidotteri.address);
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await vesting.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);

				const newGrant = await vesting.getTokenGrant(lepidotteri.address);
				expect(newGrant[0]).to.eq(START_TIME);
				expect(newGrant[1]).to.eq(grantAmount);
				expect(newGrant[2]).to.eq(VESTING_DURATION_IN_DAYS);
				expect(newGrant[3]).to.eq(VESTING_CLIFF_IN_DAYS);
				expect(newGrant[4]).to.eq(0);
				expect(await votingPower.votingPowerOf(lepidotteri.address)).to.eq(userVotesBefore.add(grantAmount));
				totalVested = totalVested.add(grantAmount);
				expect(await govToken.balanceOf(vesting.address)).to.eq(totalVested);
			});

			it('creates valid grants from file', async () => {
				await vesting.setVotingPowerContract(votingPower.address);
				await govToken.approve(vesting.address, ethers.constants.MaxUint256);
				const tokenGrants: Grant[] = grantees[network.name];
				const decimals = await govToken.decimals();
				const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_CLIFF_IN_DAYS = 1;
				let totalVested = await govToken.balanceOf(vesting.address);

				for (const grant of tokenGrants) {
					const userVotesBefore = await votingPower.votingPowerOf(grant.recipient);
					const grantAmount = ethers.BigNumber.from(parseInt(String((grant.amount as number) * 100)))
						.mul(ethers.BigNumber.from(10).pow(decimals))
						.div(100);

					await vesting.addTokenGrant(grant.recipient, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);
					const newGrant = await vesting.getTokenGrant(grant.recipient);

					expect(newGrant[0]).to.eq(START_TIME);
					expect(newGrant[1]).to.eq(grantAmount);
					expect(newGrant[2]).to.eq(VESTING_DURATION_IN_DAYS);
					expect(newGrant[3]).to.eq(VESTING_CLIFF_IN_DAYS);
					expect(newGrant[4]).to.eq(0);
					expect(await votingPower.votingPowerOf(grant.recipient)).to.eq(userVotesBefore.add(grantAmount));
					totalVested = totalVested.add(grantAmount);
				}

				expect(await govToken.balanceOf(vesting.address)).to.eq(totalVested);
			});

			it('does not allow non-owner to create a grant', async () => {
				await govToken.connect(SHA_2048).approve(vesting.address, ethers.constants.MaxUint256);
				const decimals = await govToken.decimals();
				const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_CLIFF_IN_DAYS = 1;
				const totalVested = await govToken.balanceOf(vesting.address);
				const userVotesBefore = await votingPower.votingPowerOf(lepidotteri.address);
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await expect(
					vesting
						.connect(SHA_2048)
						.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS)
				).to.revertedWith('revert Vest::addTokenGrant: not owner');
				expect(await votingPower.votingPowerOf(lepidotteri.address)).to.eq(userVotesBefore);
				expect(await govToken.balanceOf(vesting.address)).to.eq(totalVested);

				await sanityCheck_emptyGrant(vesting, lepidotteri.address);
			});

			it('does not allow a grant before voting power contract is specified', async () => {
				await govToken.approve(vesting.address, ethers.constants.MaxUint256);
				const decimals = await govToken.decimals();
				const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_CLIFF_IN_DAYS = 1;
				const totalVested = await govToken.balanceOf(vesting.address);
				const userVotesBefore = await votingPower.votingPowerOf(lepidotteri.address);
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await expect(
					vesting.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS)
				).to.revertedWith('revert Vest::addTokenGrant: Set Voting Power contract first');
				expect(await votingPower.votingPowerOf(lepidotteri.address)).to.eq(userVotesBefore);
				expect(await govToken.balanceOf(vesting.address)).to.eq(totalVested);

				await sanityCheck_emptyGrant(vesting, lepidotteri.address);
			});

			it('does not allow a grant with a cliff > 1 year', async () => {
				await vesting.setVotingPowerContract(votingPower.address);
				await govToken.approve(vesting.address, ethers.constants.MaxUint256);
				const decimals = await govToken.decimals();
				const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
				const VESTING_DURATION_IN_DAYS = 9 * 365;
				const VESTING_CLIFF_IN_DAYS = Math.floor(1.1 * 365); // Solidity underflow otherwise
				const totalVested = await govToken.balanceOf(vesting.address);
				const userVotesBefore = await votingPower.votingPowerOf(lepidotteri.address);
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await expect(
					vesting.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS)
				).to.revertedWith('revert Vest::addTokenGrant: cliff more than 1 year');
				expect(await votingPower.votingPowerOf(lepidotteri.address)).to.eq(userVotesBefore);
				expect(await govToken.balanceOf(vesting.address)).to.eq(totalVested);

				await sanityCheck_emptyGrant(vesting, lepidotteri.address);
			});

			it('does not allow a grant with a duration of 0', async () => {
				await vesting.setVotingPowerContract(votingPower.address);
				await govToken.approve(vesting.address, ethers.constants.MaxUint256);
				const decimals = await govToken.decimals();
				const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
				const VESTING_DURATION_IN_DAYS = 0;
				const VESTING_CLIFF_IN_DAYS = 0;
				const totalVested = await govToken.balanceOf(vesting.address);
				const userVotesBefore = await votingPower.votingPowerOf(lepidotteri.address);
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await expect(
					vesting.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS)
				).to.revertedWith('revert Vest::addTokenGrant: duration must be > 0');
				expect(await votingPower.votingPowerOf(lepidotteri.address)).to.eq(userVotesBefore);
				expect(await govToken.balanceOf(vesting.address)).to.eq(totalVested);

				await sanityCheck_emptyGrant(vesting, lepidotteri.address);
			});

			it('does not allow a grant with a duration of > 9 years', async () => {
				await vesting.setVotingPowerContract(votingPower.address);
				await govToken.approve(vesting.address, ethers.constants.MaxUint256);
				const decimals = await govToken.decimals();
				const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
				const VESTING_DURATION_IN_DAYS = 10 * 365;
				const VESTING_CLIFF_IN_DAYS = 1;
				const totalVested = await govToken.balanceOf(vesting.address);
				const userVotesBefore = await votingPower.votingPowerOf(lepidotteri.address);
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await expect(
					vesting.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS)
				).to.revertedWith('revert Vest::addTokenGrant: duration more than 9 years');
				expect(await votingPower.votingPowerOf(lepidotteri.address)).to.eq(userVotesBefore);
				expect(await govToken.balanceOf(vesting.address)).to.eq(totalVested);

				await sanityCheck_emptyGrant(vesting, lepidotteri.address);
			});

			it('does not allow a grant with a duration < cliff', async () => {
				await vesting.setVotingPowerContract(votingPower.address);
				await govToken.approve(vesting.address, ethers.constants.MaxUint256);
				const decimals = await govToken.decimals();
				const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
				const VESTING_DURATION_IN_DAYS = 7;
				const VESTING_CLIFF_IN_DAYS = 9;
				const totalVested = await govToken.balanceOf(vesting.address);
				const userVotesBefore = await votingPower.votingPowerOf(lepidotteri.address);
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await expect(
					vesting.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS)
				).to.revertedWith('revert Vest::addTokenGrant: duration < cliff');
				expect(await votingPower.votingPowerOf(lepidotteri.address)).to.eq(userVotesBefore);
				expect(await govToken.balanceOf(vesting.address)).to.eq(totalVested);

				await sanityCheck_emptyGrant(vesting, lepidotteri.address);
			});

			it('does not allow a grant for an account with an existing grant', async () => {
				await vesting.setVotingPowerContract(votingPower.address);
				await govToken.approve(vesting.address, ethers.constants.MaxUint256);
				const decimals = await govToken.decimals();
				const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_CLIFF_IN_DAYS = 1;
				let totalVested = await govToken.balanceOf(vesting.address);
				const userVotesBefore = await votingPower.votingPowerOf(lepidotteri.address);
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await vesting.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);
				const newGrant = await vesting.getTokenGrant(lepidotteri.address);

				expect(newGrant[0]).to.eq(START_TIME);
				expect(newGrant[1]).to.eq(grantAmount);
				expect(newGrant[2]).to.eq(VESTING_DURATION_IN_DAYS);
				expect(newGrant[3]).to.eq(VESTING_CLIFF_IN_DAYS);
				expect(newGrant[4]).to.eq(0);
				const userVotesAfter = userVotesBefore.add(grantAmount);
				expect(await votingPower.votingPowerOf(lepidotteri.address)).to.eq(userVotesAfter);
				totalVested = totalVested.add(grantAmount);
				expect(await govToken.balanceOf(vesting.address)).to.eq(totalVested);

				await expect(
					vesting.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS)
				).to.revertedWith('revert Vest::addTokenGrant: grant already exists for account');
				expect(await votingPower.votingPowerOf(lepidotteri.address)).to.eq(userVotesAfter);
				expect(await govToken.balanceOf(vesting.address)).to.eq(totalVested);
				const existingGrant = await vesting.getTokenGrant(lepidotteri.address);
				expect(existingGrant[0]).to.eq(START_TIME);
				expect(existingGrant[1]).to.eq(grantAmount);
				expect(existingGrant[2]).to.eq(VESTING_DURATION_IN_DAYS);
				expect(existingGrant[3]).to.eq(VESTING_CLIFF_IN_DAYS);
				expect(existingGrant[4]).to.eq(0);
			});

			it('does not allow a grant of 0', async () => {
				await vesting.setVotingPowerContract(votingPower.address);
				await govToken.approve(vesting.address, ethers.constants.MaxUint256);

				const decimals = await govToken.decimals();
				const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_CLIFF_IN_DAYS = 1;
				const totalVested = await govToken.balanceOf(vesting.address);
				const userVotesBefore = await votingPower.votingPowerOf(lepidotteri.address);
				const grantAmount = ethers.BigNumber.from(0).mul(ethers.BigNumber.from(10).pow(decimals));

				await expect(
					vesting.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS)
				).to.revertedWith('revert Vest::addTokenGrant: amountVestedPerDay > 0');
				expect(await votingPower.votingPowerOf(lepidotteri.address)).to.eq(userVotesBefore);
				expect(await govToken.balanceOf(vesting.address)).to.eq(totalVested);

				await sanityCheck_emptyGrant(vesting, lepidotteri.address);
			});

			it('does not allow a grant where tokens vested per day < 1', async () => {
				await vesting.setVotingPowerContract(votingPower.address);
				await govToken.approve(vesting.address, ethers.constants.MaxUint256);

				const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_CLIFF_IN_DAYS = 1;
				const totalVested = await govToken.balanceOf(vesting.address);
				const userVotesBefore = await votingPower.votingPowerOf(lepidotteri.address);
				const grantAmount = ethers.BigNumber.from(3);

				await expect(
					vesting.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS)
				).to.revertedWith('revert Vest::addTokenGrant: amountVestedPerDay > 0');
				expect(await votingPower.votingPowerOf(lepidotteri.address)).to.eq(userVotesBefore);
				expect(await govToken.balanceOf(vesting.address)).to.eq(totalVested);

				await sanityCheck_emptyGrant(vesting, lepidotteri.address);
			});

			it('does not allow a grant when owner has insufficient balance', async () => {
				await vesting.setVotingPowerContract(votingPower.address);
				await govToken.approve(vesting.address, ethers.constants.MaxUint256);
				await govToken.transfer(SHA_2048.address, await govToken.balanceOf(deployer.address));

				const decimals = await govToken.decimals();
				const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_CLIFF_IN_DAYS = 1;
				const totalVested = await govToken.balanceOf(vesting.address);
				const userVotesBefore = await votingPower.votingPowerOf(lepidotteri.address);
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await expect(
					vesting.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS)
				).to.revertedWith('revert CrownGovernanceToken::_transferTokens: transfer exceeds from balance');
				expect(await votingPower.votingPowerOf(lepidotteri.address)).to.eq(userVotesBefore);
				expect(await govToken.balanceOf(vesting.address)).to.eq(totalVested);

				await sanityCheck_emptyGrant(vesting, lepidotteri.address);
			});
		});

		context('tokensVestedPerDay', async () => {
			it('returns correct tokens vested per day', async () => {
				await vesting.setVotingPowerContract(votingPower.address);
				await govToken.approve(vesting.address, ethers.constants.MaxUint256);

				const decimals = await govToken.decimals();
				const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_CLIFF_IN_DAYS = 1;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await vesting.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);

				expect(await vesting.tokensVestedPerDay(lepidotteri.address)).to.eq(grantAmount.div(VESTING_DURATION_IN_DAYS));
			});
		});

		context('calculateGrantClaim', async () => {
			it('returns 0 before grant start time', async () => {
				await vesting.setVotingPowerContract(votingPower.address);
				await govToken.approve(vesting.address, ethers.constants.MaxUint256);

				const decimals = await govToken.decimals();
				const { timestamp } = await ethers.provider.getBlock('latest');
				const START_TIME = timestamp + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_CLIFF_IN_DAYS = 1;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await vesting.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);

				expect(await vesting.calculateGrantClaim(lepidotteri.address)).to.eq(0);
			});

			it('returns 0 before grant cliff', async () => {
				await vesting.setVotingPowerContract(votingPower.address);
				await govToken.approve(vesting.address, ethers.constants.MaxUint256);

				const decimals = await govToken.decimals();
				const { timestamp } = await ethers.provider.getBlock('latest');
				const START_TIME = timestamp + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_CLIFF_IN_DAYS = 1;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await vesting.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);

				await ethers.provider.send('evm_setNextBlockTimestamp', [timestamp + 21600]);
				await ethers.provider.send('evm_mine', []);

				expect(await vesting.calculateGrantClaim(lepidotteri.address)).to.eq(0);
			});

			it('returns total grant if after duration and none claimed', async () => {
				await vesting.setVotingPowerContract(votingPower.address);
				await govToken.approve(vesting.address, ethers.constants.MaxUint256);

				const { timestamp } = await ethers.provider.getBlock('latest');
				const decimals = await govToken.decimals();
				const START_TIME = timestamp + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60;
				const VESTING_CLIFF_IN_DAYS = 1;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await vesting.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);

				await ethers.provider.send('evm_setNextBlockTimestamp', [timestamp + 21600 + VESTING_DURATION_IN_SECS]);
				await ethers.provider.send('evm_mine', []);

				expect(await vesting.calculateGrantClaim(lepidotteri.address)).to.eq(grantAmount);
			});

			it('returns remaining grant if after duration and some claimed', async () => {
				await vesting.setVotingPowerContract(votingPower.address);
				await govToken.approve(vesting.address, ethers.constants.MaxUint256);

				const { timestamp } = await ethers.provider.getBlock('latest');
				const START_TIME = timestamp + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60;
				const VESTING_CLIFF_IN_DAYS = 1;
				const VESTING_CLIFF_IN_SECS = VESTING_CLIFF_IN_DAYS * 24 * 60 * 60;
				const decimals = await govToken.decimals();
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await vesting.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);
				await ethers.provider.send('evm_setNextBlockTimestamp', [timestamp + 21600 + VESTING_CLIFF_IN_SECS * 2]);

				await vesting.claimVestedTokens(lepidotteri.address);

				const amountClaimed = await vesting.claimedBalance(lepidotteri.address);
				await ethers.provider.send('evm_setNextBlockTimestamp', [timestamp + 21600 + VESTING_DURATION_IN_SECS]);
				await ethers.provider.send('evm_mine', []);

				expect(await vesting.calculateGrantClaim(lepidotteri.address)).to.eq(grantAmount.sub(amountClaimed));
			});

			it('returns claimable balance if after cliff and none claimed', async () => {
				await vesting.setVotingPowerContract(votingPower.address);
				await govToken.approve(vesting.address, ethers.constants.MaxUint256);

				const { timestamp } = await ethers.provider.getBlock('latest');
				const decimals = await govToken.decimals();
				const START_TIME = timestamp + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60;
				const VESTING_CLIFF_IN_DAYS = 1;
				const VESTING_CLIFF_IN_SECS = VESTING_CLIFF_IN_DAYS * 24 * 60 * 60;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await vesting.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);
				const newTime = timestamp + 21600 + VESTING_CLIFF_IN_SECS + 60;

				await ethers.provider.send('evm_setNextBlockTimestamp', [newTime]);
				await ethers.provider.send('evm_mine', []);
				const elapsedTime = newTime - START_TIME;

				expect(await vesting.calculateGrantClaim(lepidotteri.address)).to.eq(
					grantAmount.div(VESTING_DURATION_IN_SECS).mul(elapsedTime)
				);
			});

			it('returns claimable balance if after cliff and some claimed', async () => {
				await vesting.setVotingPowerContract(votingPower.address);
				await govToken.approve(vesting.address, ethers.constants.MaxUint256);

				const decimals = await govToken.decimals();
				const { timestamp } = await ethers.provider.getBlock('latest');
				const START_TIME = timestamp + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60;
				const VESTING_CLIFF_IN_DAYS = 1;
				const VESTING_CLIFF_IN_SECS = VESTING_CLIFF_IN_DAYS * 24 * 60 * 60;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await vesting.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);

				let newTime = timestamp + 21600 + VESTING_CLIFF_IN_SECS + 60;
				await ethers.provider.send('evm_setNextBlockTimestamp', [newTime]);
				await ethers.provider.send('evm_mine', []);

				await vesting.claimVestedTokens(lepidotteri.address);

				const amountClaimed = await vesting.claimedBalance(lepidotteri.address);
				newTime = timestamp + 21600 + VESTING_CLIFF_IN_SECS + 60 + 60;
				await ethers.provider.send('evm_setNextBlockTimestamp', [newTime]);
				await ethers.provider.send('evm_mine', []);
				const elapsedTime = newTime - START_TIME;

				expect(await vesting.calculateGrantClaim(lepidotteri.address)).to.eq(
					grantAmount.div(VESTING_DURATION_IN_SECS).mul(elapsedTime).sub(amountClaimed)
				);
			});
		});

		context('vestedBalance', async () => {
			it('returns 0 before grant start time', async () => {
				await vesting.setVotingPowerContract(votingPower.address);
				await govToken.approve(vesting.address, ethers.constants.MaxUint256);

				const decimals = await govToken.decimals();
				const { timestamp } = await ethers.provider.getBlock('latest');
				const START_TIME = timestamp + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_CLIFF_IN_DAYS = 1;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await vesting.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);

				expect(await vesting.vestedBalance(lepidotteri.address)).to.eq(0);
			});

			it('returns 0 before grant cliff', async () => {
				await vesting.setVotingPowerContract(votingPower.address);
				await govToken.approve(vesting.address, ethers.constants.MaxUint256);

				const decimals = await govToken.decimals();
				const { timestamp } = await ethers.provider.getBlock('latest');
				const START_TIME = timestamp + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_CLIFF_IN_DAYS = 1;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await vesting.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);

				await ethers.provider.send('evm_setNextBlockTimestamp', [timestamp + 21600]);
				await ethers.provider.send('evm_mine', []);

				expect(await vesting.vestedBalance(lepidotteri.address)).to.eq(0);
			});

			it('returns total grant if after duration and none claimed', async () => {
				await vesting.setVotingPowerContract(votingPower.address);
				await govToken.approve(vesting.address, ethers.constants.MaxUint256);

				const decimals = await govToken.decimals();
				const { timestamp } = await ethers.provider.getBlock('latest');
				const START_TIME = timestamp + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60;
				const VESTING_CLIFF_IN_DAYS = 1;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await vesting.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);
				await ethers.provider.send('evm_setNextBlockTimestamp', [timestamp + 21600 + VESTING_DURATION_IN_SECS]);
				await ethers.provider.send('evm_mine', []);

				expect(await vesting.vestedBalance(lepidotteri.address)).to.eq(grantAmount);
			});

			it('returns total grant if after duration and some claimed', async () => {
				await vesting.setVotingPowerContract(votingPower.address);
				await govToken.approve(vesting.address, ethers.constants.MaxUint256);

				const decimals = await govToken.decimals();
				const { timestamp } = await ethers.provider.getBlock('latest');
				const START_TIME = timestamp + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60;
				const VESTING_CLIFF_IN_DAYS = 1;
				const VESTING_CLIFF_IN_SECS = VESTING_CLIFF_IN_DAYS * 24 * 60 * 60;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await vesting.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);
				await ethers.provider.send('evm_setNextBlockTimestamp', [timestamp + 21600 + VESTING_CLIFF_IN_SECS * 2]);
				await vesting.claimVestedTokens(lepidotteri.address);
				await ethers.provider.send('evm_setNextBlockTimestamp', [timestamp + 21600 + VESTING_DURATION_IN_SECS]);
				await ethers.provider.send('evm_mine', []);

				expect(await vesting.vestedBalance(lepidotteri.address)).to.eq(grantAmount);
			});

			it('returns vested balance if after cliff and none claimed', async () => {
				await vesting.setVotingPowerContract(votingPower.address);
				await govToken.approve(vesting.address, ethers.constants.MaxUint256);

				const decimals = await govToken.decimals();
				const { timestamp } = await ethers.provider.getBlock('latest');
				const START_TIME = timestamp + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60;
				const VESTING_CLIFF_IN_DAYS = 1;
				const VESTING_CLIFF_IN_SECS = VESTING_CLIFF_IN_DAYS * 24 * 60 * 60;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await vesting.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);

				const newTime = timestamp + 21600 + VESTING_CLIFF_IN_SECS + 60;
				await ethers.provider.send('evm_setNextBlockTimestamp', [newTime]);
				await ethers.provider.send('evm_mine', []);
				const elapsedTime = newTime - START_TIME;

				expect(await vesting.vestedBalance(lepidotteri.address)).to.eq(grantAmount.div(VESTING_DURATION_IN_SECS).mul(elapsedTime));
			});

			it('returns vested balance if after cliff and some claimed', async () => {
				await vesting.setVotingPowerContract(votingPower.address);
				await govToken.approve(vesting.address, ethers.constants.MaxUint256);

				const decimals = await govToken.decimals();
				const { timestamp } = await ethers.provider.getBlock('latest');
				const START_TIME = timestamp + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60;
				const VESTING_CLIFF_IN_DAYS = 1;
				const VESTING_CLIFF_IN_SECS = VESTING_CLIFF_IN_DAYS * 24 * 60 * 60;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await vesting.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);

				let newTime = timestamp + 21600 + VESTING_CLIFF_IN_SECS + 60;
				await ethers.provider.send('evm_setNextBlockTimestamp', [newTime]);
				await ethers.provider.send('evm_mine', []);

				await vesting.claimVestedTokens(lepidotteri.address);

				newTime = timestamp + 21600 + VESTING_CLIFF_IN_SECS + 60 + 60;
				await ethers.provider.send('evm_setNextBlockTimestamp', [newTime]);
				await ethers.provider.send('evm_mine', []);
				const elapsedTime = newTime - START_TIME;

				expect(await vesting.vestedBalance(lepidotteri.address)).to.eq(grantAmount.div(VESTING_DURATION_IN_SECS).mul(elapsedTime));
			});
		});

		context('claimVestedTokens', async () => {
			it('does not allow user to claim if no tokens have vested', async () => {
				await vesting.setVotingPowerContract(votingPower.address);
				await govToken.approve(vesting.address, ethers.constants.MaxUint256);

				const decimals = await govToken.decimals();
				const { timestamp } = await ethers.provider.getBlock('latest');
				const START_TIME = timestamp + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_CLIFF_IN_DAYS = 1;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await vesting.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);

				await expect(vesting.claimVestedTokens(lepidotteri.address)).to.revertedWith('revert Vest::claimVested: amountVested is 0');
			});

			it('allows user to claim vested tokens once', async () => {
				await vesting.setVotingPowerContract(votingPower.address);
				await govToken.approve(vesting.address, ethers.constants.MaxUint256);

				const decimals = await govToken.decimals();
				const { timestamp } = await ethers.provider.getBlock('latest');
				const START_TIME = timestamp + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60;
				const VESTING_CLIFF_IN_DAYS = 1;
				const VESTING_CLIFF_IN_SECS = VESTING_CLIFF_IN_DAYS * 24 * 60 * 60;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await vesting.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);
				const userVotingPowerBefore = await votingPower.votingPowerOf(lepidotteri.address);

				expect(userVotingPowerBefore).to.eq(grantAmount);

				const newTime = timestamp + 21600 + VESTING_CLIFF_IN_SECS + 60;
				const elapsedTime = newTime - START_TIME;
				const claimAmount = grantAmount.div(VESTING_DURATION_IN_SECS).mul(elapsedTime);
				const userTokenBalanceBefore = await govToken.balanceOf(lepidotteri.address);
				const contractTokenBalanceBefore = await govToken.balanceOf(vesting.address);

				await ethers.provider.send('evm_setNextBlockTimestamp', [newTime]);
				await vesting.claimVestedTokens(lepidotteri.address);

				expect(await vesting.claimedBalance(lepidotteri.address)).to.eq(claimAmount);
				expect(await votingPower.votingPowerOf(lepidotteri.address)).to.eq(userVotingPowerBefore.sub(claimAmount));
				expect(await govToken.balanceOf(lepidotteri.address)).to.eq(userTokenBalanceBefore.add(claimAmount));
				expect(await govToken.balanceOf(vesting.address)).to.eq(contractTokenBalanceBefore.sub(claimAmount));
			});

			it('allows user to claim vested tokens multiple times', async () => {
				await vesting.setVotingPowerContract(votingPower.address);
				await govToken.approve(vesting.address, ethers.constants.MaxUint256);

				const decimals = await govToken.decimals();
				const { timestamp } = await ethers.provider.getBlock('latest');
				const START_TIME = timestamp + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60;
				const VESTING_CLIFF_IN_DAYS = 1;
				const VESTING_CLIFF_IN_SECS = VESTING_CLIFF_IN_DAYS * 24 * 60 * 60;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await vesting.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);
				const userVotingPowerBefore = await votingPower.votingPowerOf(lepidotteri.address);

				expect(userVotingPowerBefore).to.eq(grantAmount);

				let newTime = timestamp + 21600 + VESTING_CLIFF_IN_SECS + 60;
				let elapsedTime = newTime - START_TIME;
				const claimAmount = grantAmount.div(VESTING_DURATION_IN_SECS).mul(elapsedTime);
				let userTokenBalanceBefore = await govToken.balanceOf(lepidotteri.address);
				let contractTokenBalanceBefore = await govToken.balanceOf(vesting.address);

				await ethers.provider.send('evm_setNextBlockTimestamp', [newTime]);
				await vesting.claimVestedTokens(lepidotteri.address);

				expect(await vesting.claimedBalance(lepidotteri.address)).to.eq(claimAmount);
				expect(await votingPower.votingPowerOf(lepidotteri.address)).to.eq(userVotingPowerBefore.sub(claimAmount));
				expect(await govToken.balanceOf(lepidotteri.address)).to.eq(userTokenBalanceBefore.add(claimAmount));
				expect(await govToken.balanceOf(vesting.address)).to.eq(contractTokenBalanceBefore.sub(claimAmount));

				newTime = timestamp + 21600 + VESTING_CLIFF_IN_SECS + 60 + 60;
				elapsedTime = newTime - START_TIME;
				const newClaimAmount = grantAmount.div(VESTING_DURATION_IN_SECS).mul(elapsedTime).sub(claimAmount);

				userTokenBalanceBefore = await govToken.balanceOf(lepidotteri.address);
				contractTokenBalanceBefore = await govToken.balanceOf(vesting.address);

				await ethers.provider.send('evm_setNextBlockTimestamp', [newTime]);
				await vesting.claimVestedTokens(lepidotteri.address);

				expect(await vesting.claimedBalance(lepidotteri.address)).to.eq(claimAmount.add(newClaimAmount));
				expect(await votingPower.votingPowerOf(lepidotteri.address)).to.eq(userVotingPowerBefore.sub(claimAmount).sub(newClaimAmount));
				expect(await govToken.balanceOf(lepidotteri.address)).to.eq(userTokenBalanceBefore.add(newClaimAmount));
				expect(await govToken.balanceOf(vesting.address)).to.eq(contractTokenBalanceBefore.sub(newClaimAmount));
			});
		});

		context('setVotingPowerContract', async () => {
			it('allows owner to set valid voting power contract', async () => {
				await vesting.setVotingPowerContract(votingPower.address);

				expect(await vesting.votingPower()).to.eq(votingPower.address);
			});

			it('does not allow non-owner to set voting power contract', async () => {
				await expect(vesting.connect(lepidotteri).setVotingPowerContract(votingPower.address)).to.revertedWith(
					'revert Vest::setVotingPowerContract: not owner'
				);

				expect(await vesting.votingPower()).to.eq(ZERO_ADDRESS);
			});

			it('does not allow owner to set invalid voting power contract', async () => {
				await expect(vesting.setVotingPowerContract(ZERO_ADDRESS)).to.revertedWith(
					'revert Vest::setVotingPowerContract: not valid contract'
				);
				await expect(vesting.setVotingPowerContract(vesting.address)).to.revertedWith(
					'revert Vest::setVotingPowerContract: not valid contract'
				);
				await expect(vesting.setVotingPowerContract(govToken.address)).to.revertedWith(
					'revert Vest::setVotingPowerContract: not valid contract'
				);
				expect(await vesting.votingPower()).to.eq(ZERO_ADDRESS);
			});
		});

		context('changeOwner', async () => {
			it('allows owner to set new valid owner', async () => {
				await vesting.changeOwner(lepidotteri.address);

				expect(await vesting.owner()).to.eq(lepidotteri.address);
			});

			it('does not allow non-owner to change owner', async () => {
				await expect(vesting.connect(lepidotteri).changeOwner(SHA_2048.address)).to.revertedWith('revert Vest::changeOwner: not owner');

				expect(await vesting.owner()).to.eq(deployer.address);
			});

			it('does not allow owner to set invalid owner', async () => {
				await expect(vesting.changeOwner(ZERO_ADDRESS)).to.revertedWith('revert Vest::changeOwner: not valid address');
				await expect(vesting.changeOwner(vesting.address)).to.revertedWith('revert Vest::changeOwner: not valid address');
				await expect(vesting.changeOwner(govToken.address)).to.revertedWith('revert Vest::changeOwner: not valid address');

				expect(await vesting.owner()).to.eq(deployer.address);
			});
		});
	});
});
