import { expect } from 'chai';
import { ethers, network } from 'hardhat';

import { Contract } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import { governance } from '../fixtures';
import { Grant, grantees } from '../../libs/grants/utils';
import { O_Address } from '../../libs/ethereum';

async function sanityCheck_emptyGrant(emptyGrant: any) {
	expect(emptyGrant[0]).to.eq(0);
	expect(emptyGrant[1]).to.eq(0);
	expect(emptyGrant[2]).to.eq(0);
	expect(emptyGrant[3]).to.eq(0);
	expect(emptyGrant[4]).to.eq(0);
}

describe('Monastery', () => {
	let govToken: Contract;
	let monastery: Contract;
	let crown: Contract;
	let crownPrism: Contract;
	let crownImp: Contract;

	let deployer: SignerWithAddress;
	let admin: SignerWithAddress;
	let lepidotteri: SignerWithAddress;
	let SHA_2048: SignerWithAddress;
	let Jester: SignerWithAddress;

	beforeEach(async () => {
		const f = await governance();

		govToken = f.govToken;
		monastery = f.monastery;
		crown = f.crown;
		crownPrism = f.crownPrism;
		crownImp = f.crownImp;
		deployer = f.deployer;
		admin = f.admin;
		lepidotteri = f.lepidotteri;
		SHA_2048 = f.SHA_2048;
		Jester = f.Jester;

		await crownPrism.setPendingProxyImplementation(crownImp.address);
		await crownImp.become(crownPrism.address);
	});

	context('Pre-init', async () => {
		context('setVotingPowerContract', async () => {
			it('reverts', async () => {
				await expect(monastery.setVotingPowerContract(crown.address)).to.revertedWith(
					'Monastery::setVotingPowerContract: voting power not initialized'
				);
			});
		});
	});

	context('Post-init', async () => {
		beforeEach(async () => {
			await crown.initialize(govToken.address, monastery.address);
		});

		context('addGrant', async () => {
			it('creates valid grant', async () => {
				const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_CLIFF_IN_DAYS = 1;
				await monastery.setVotingPowerContract(crown.address);
				await govToken.approve(monastery.address, ethers.constants.MaxUint256);
				const decimals = await govToken.decimals();
				let totalVested = await govToken.balanceOf(monastery.address);
				const userVotesBefore = await crown.votingPowerOf(lepidotteri.address);
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await monastery.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);

				const newGrant = await monastery.getTokenGrant(lepidotteri.address);
				expect(newGrant[0]).to.eq(START_TIME);
				expect(newGrant[1]).to.eq(grantAmount);
				expect(newGrant[2]).to.eq(VESTING_DURATION_IN_DAYS);
				expect(newGrant[3]).to.eq(VESTING_CLIFF_IN_DAYS);
				expect(newGrant[4]).to.eq(0);
				expect(await crown.votingPowerOf(lepidotteri.address)).to.eq(userVotesBefore.add(grantAmount));
				totalVested = totalVested.add(grantAmount);
				expect(await govToken.balanceOf(monastery.address)).to.eq(totalVested);
			});

			it('creates valid grants from file', async () => {
				await monastery.setVotingPowerContract(crown.address);
				await govToken.approve(monastery.address, ethers.constants.MaxUint256);
				const tokenGrants: Grant[] = grantees[network.name];
				const decimals = await govToken.decimals();
				const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_CLIFF_IN_DAYS = 1;
				let totalVested = await govToken.balanceOf(monastery.address);

				for (const grant of tokenGrants) {
					const userVotesBefore = await crown.votingPowerOf(grant.recipient);
					const grantAmount = ethers.BigNumber.from(parseInt(String((grant.amount as number) * 100)))
						.mul(ethers.BigNumber.from(10).pow(decimals))
						.div(100);

					await monastery.addTokenGrant(grant.recipient, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);
					const newGrant = await monastery.getTokenGrant(grant.recipient);

					expect(newGrant[0]).to.eq(START_TIME);
					expect(newGrant[1]).to.eq(grantAmount);
					expect(newGrant[2]).to.eq(VESTING_DURATION_IN_DAYS);
					expect(newGrant[3]).to.eq(VESTING_CLIFF_IN_DAYS);
					expect(newGrant[4]).to.eq(0);
					expect(await crown.votingPowerOf(grant.recipient)).to.eq(userVotesBefore.add(grantAmount));
					totalVested = totalVested.add(grantAmount);
				}

				expect(await govToken.balanceOf(monastery.address)).to.eq(totalVested);
			});

			it('does not allow non-clergy to create a grant', async () => {
				await govToken.connect(SHA_2048).approve(monastery.address, ethers.constants.MaxUint256);
				const decimals = await govToken.decimals();
				const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_CLIFF_IN_DAYS = 1;
				const totalVested = await govToken.balanceOf(monastery.address);
				const userVotesBefore = await crown.votingPowerOf(lepidotteri.address);
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await expect(
					monastery
						.connect(SHA_2048)
						.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS)
				).to.revertedWith('revert Monastery::onlyChurch: not clergy');
				expect(await crown.votingPowerOf(lepidotteri.address)).to.eq(userVotesBefore);
				expect(await govToken.balanceOf(monastery.address)).to.eq(totalVested);

				const emptyGrant = await monastery.getTokenGrant(lepidotteri.address);
				await sanityCheck_emptyGrant(emptyGrant);
			});

			it('does not allow a grant before voting power contract is specified', async () => {
				await govToken.approve(monastery.address, ethers.constants.MaxUint256);
				const decimals = await govToken.decimals();
				const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_CLIFF_IN_DAYS = 1;
				const totalVested = await govToken.balanceOf(monastery.address);
				const userVotesBefore = await crown.votingPowerOf(lepidotteri.address);
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await expect(
					monastery.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS)
				).to.revertedWith('revert Monastery::addTokenGrant: Set Voting Power contract first');
				expect(await crown.votingPowerOf(lepidotteri.address)).to.eq(userVotesBefore);
				expect(await govToken.balanceOf(monastery.address)).to.eq(totalVested);

				const emptyGrant = await monastery.getTokenGrant(lepidotteri.address);
				await sanityCheck_emptyGrant(emptyGrant);
			});

			it('does not allow a grant with a cliff > 1 year', async () => {
				await monastery.setVotingPowerContract(crown.address);
				await govToken.approve(monastery.address, ethers.constants.MaxUint256);
				const decimals = await govToken.decimals();
				const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
				const VESTING_DURATION_IN_DAYS = 9 * 365;
				const VESTING_CLIFF_IN_DAYS = Math.floor(1.1 * 365); // Solidity underflow otherwise
				const totalVested = await govToken.balanceOf(monastery.address);
				const userVotesBefore = await crown.votingPowerOf(lepidotteri.address);
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await expect(
					monastery.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS)
				).to.revertedWith('revert Monastery::addTokenGrant: cliff more than 1 year');
				expect(await crown.votingPowerOf(lepidotteri.address)).to.eq(userVotesBefore);
				expect(await govToken.balanceOf(monastery.address)).to.eq(totalVested);

				const emptyGrant = await monastery.getTokenGrant(lepidotteri.address);
				await sanityCheck_emptyGrant(emptyGrant);
			});

			it('does not allow a grant with a duration of 0', async () => {
				await monastery.setVotingPowerContract(crown.address);
				await govToken.approve(monastery.address, ethers.constants.MaxUint256);
				const decimals = await govToken.decimals();
				const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
				const VESTING_DURATION_IN_DAYS = 0;
				const VESTING_CLIFF_IN_DAYS = 0;
				const totalVested = await govToken.balanceOf(monastery.address);
				const userVotesBefore = await crown.votingPowerOf(lepidotteri.address);
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await expect(
					monastery.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS)
				).to.revertedWith('revert Monastery::addTokenGrant: duration must be > 0');
				expect(await crown.votingPowerOf(lepidotteri.address)).to.eq(userVotesBefore);
				expect(await govToken.balanceOf(monastery.address)).to.eq(totalVested);

				const emptyGrant = await monastery.getTokenGrant(lepidotteri.address);
				await sanityCheck_emptyGrant(emptyGrant);
			});

			it('does not allow a grant with a duration of > 9 years', async () => {
				await monastery.setVotingPowerContract(crown.address);
				await govToken.approve(monastery.address, ethers.constants.MaxUint256);
				const decimals = await govToken.decimals();
				const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
				const VESTING_DURATION_IN_DAYS = 10 * 365;
				const VESTING_CLIFF_IN_DAYS = 1;
				const totalVested = await govToken.balanceOf(monastery.address);
				const userVotesBefore = await crown.votingPowerOf(lepidotteri.address);
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await expect(
					monastery.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS)
				).to.revertedWith('revert Monastery::addTokenGrant: duration more than 9 years');
				expect(await crown.votingPowerOf(lepidotteri.address)).to.eq(userVotesBefore);
				expect(await govToken.balanceOf(monastery.address)).to.eq(totalVested);

				const emptyGrant = await monastery.getTokenGrant(lepidotteri.address);
				await sanityCheck_emptyGrant(emptyGrant);
			});

			it('does not allow a grant with a duration < cliff', async () => {
				await monastery.setVotingPowerContract(crown.address);
				await govToken.approve(monastery.address, ethers.constants.MaxUint256);
				const decimals = await govToken.decimals();
				const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
				const VESTING_DURATION_IN_DAYS = 7;
				const VESTING_CLIFF_IN_DAYS = 9;
				const totalVested = await govToken.balanceOf(monastery.address);
				const userVotesBefore = await crown.votingPowerOf(lepidotteri.address);
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await expect(
					monastery.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS)
				).to.revertedWith('revert Monastery::addTokenGrant: duration < cliff');
				expect(await crown.votingPowerOf(lepidotteri.address)).to.eq(userVotesBefore);
				expect(await govToken.balanceOf(monastery.address)).to.eq(totalVested);

				const emptyGrant = await monastery.getTokenGrant(lepidotteri.address);
				await sanityCheck_emptyGrant(emptyGrant);
			});

			it('does not allow a grant for an account with an existing grant', async () => {
				await monastery.setVotingPowerContract(crown.address);
				await govToken.approve(monastery.address, ethers.constants.MaxUint256);
				const decimals = await govToken.decimals();
				const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_CLIFF_IN_DAYS = 1;
				let totalVested = await govToken.balanceOf(monastery.address);
				const userVotesBefore = await crown.votingPowerOf(lepidotteri.address);
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await monastery.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);
				const newGrant = await monastery.getTokenGrant(lepidotteri.address);

				expect(newGrant[0]).to.eq(START_TIME);
				expect(newGrant[1]).to.eq(grantAmount);
				expect(newGrant[2]).to.eq(VESTING_DURATION_IN_DAYS);
				expect(newGrant[3]).to.eq(VESTING_CLIFF_IN_DAYS);
				expect(newGrant[4]).to.eq(0);
				const userVotesAfter = userVotesBefore.add(grantAmount);
				expect(await crown.votingPowerOf(lepidotteri.address)).to.eq(userVotesAfter);
				totalVested = totalVested.add(grantAmount);
				expect(await govToken.balanceOf(monastery.address)).to.eq(totalVested);

				await expect(
					monastery.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS)
				).to.revertedWith('revert Monastery::addTokenGrant: grant already exists for account');
				expect(await crown.votingPowerOf(lepidotteri.address)).to.eq(userVotesAfter);
				expect(await govToken.balanceOf(monastery.address)).to.eq(totalVested);
				const existingGrant = await monastery.getTokenGrant(lepidotteri.address);
				expect(existingGrant[0]).to.eq(START_TIME);
				expect(existingGrant[1]).to.eq(grantAmount);
				expect(existingGrant[2]).to.eq(VESTING_DURATION_IN_DAYS);
				expect(existingGrant[3]).to.eq(VESTING_CLIFF_IN_DAYS);
				expect(existingGrant[4]).to.eq(0);
			});

			it('does not allow a grant of 0', async () => {
				await monastery.setVotingPowerContract(crown.address);
				await govToken.approve(monastery.address, ethers.constants.MaxUint256);

				const decimals = await govToken.decimals();
				const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_CLIFF_IN_DAYS = 1;
				const totalVested = await govToken.balanceOf(monastery.address);
				const userVotesBefore = await crown.votingPowerOf(lepidotteri.address);
				const grantAmount = ethers.BigNumber.from(0).mul(ethers.BigNumber.from(10).pow(decimals));

				await expect(
					monastery.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS)
				).to.revertedWith('revert Monastery::addTokenGrant: amountVestedPerDay > 0');
				expect(await crown.votingPowerOf(lepidotteri.address)).to.eq(userVotesBefore);
				expect(await govToken.balanceOf(monastery.address)).to.eq(totalVested);

				const emptyGrant = await monastery.getTokenGrant(lepidotteri.address);
				await sanityCheck_emptyGrant(emptyGrant);
			});

			it('does not allow a grant where tokens vested per day < 1', async () => {
				await monastery.setVotingPowerContract(crown.address);
				await govToken.approve(monastery.address, ethers.constants.MaxUint256);

				const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_CLIFF_IN_DAYS = 1;
				const totalVested = await govToken.balanceOf(monastery.address);
				const userVotesBefore = await crown.votingPowerOf(lepidotteri.address);
				const grantAmount = ethers.BigNumber.from(3);

				await expect(
					monastery.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS)
				).to.revertedWith('revert Monastery::addTokenGrant: amountVestedPerDay > 0');
				expect(await crown.votingPowerOf(lepidotteri.address)).to.eq(userVotesBefore);
				expect(await govToken.balanceOf(monastery.address)).to.eq(totalVested);

				const emptyGrant = await monastery.getTokenGrant(lepidotteri.address);
				await sanityCheck_emptyGrant(emptyGrant);
			});

			it('does not allow a grant when owner has insufficient balance', async () => {
				await monastery.setVotingPowerContract(crown.address);
				await govToken.approve(monastery.address, ethers.constants.MaxUint256);
				await govToken.transfer(SHA_2048.address, await govToken.balanceOf(deployer.address));

				const decimals = await govToken.decimals();
				const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_CLIFF_IN_DAYS = 1;
				const totalVested = await govToken.balanceOf(monastery.address);
				const userVotesBefore = await crown.votingPowerOf(lepidotteri.address);
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await expect(
					monastery.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS)
				).to.revertedWith('revert KING::_transferTokens: transfer exceeds from balance');
				expect(await crown.votingPowerOf(lepidotteri.address)).to.eq(userVotesBefore);
				expect(await govToken.balanceOf(monastery.address)).to.eq(totalVested);

				const emptyGrant = await monastery.getTokenGrant(lepidotteri.address);
				await sanityCheck_emptyGrant(emptyGrant);
			});
		});

		context('tokensVestedPerDay', async () => {
			it('returns correct tokens vested per day', async () => {
				await monastery.setVotingPowerContract(crown.address);
				await govToken.approve(monastery.address, ethers.constants.MaxUint256);

				const decimals = await govToken.decimals();
				const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_CLIFF_IN_DAYS = 1;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await monastery.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);

				expect(await monastery.tokensVestedPerDay(lepidotteri.address)).to.eq(grantAmount.div(VESTING_DURATION_IN_DAYS));
			});
		});

		context('calculateGrantClaim', async () => {
			it('returns 0 before grant start time', async () => {
				await monastery.setVotingPowerContract(crown.address);
				await govToken.approve(monastery.address, ethers.constants.MaxUint256);

				const decimals = await govToken.decimals();
				const { timestamp } = await ethers.provider.getBlock('latest');
				const START_TIME = timestamp + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_CLIFF_IN_DAYS = 1;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await monastery.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);

				expect(await monastery.calculateGrantClaim(lepidotteri.address)).to.eq(0);
			});

			it('returns 0 before grant cliff', async () => {
				await monastery.setVotingPowerContract(crown.address);
				await govToken.approve(monastery.address, ethers.constants.MaxUint256);

				const decimals = await govToken.decimals();
				const { timestamp } = await ethers.provider.getBlock('latest');
				const START_TIME = timestamp + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_CLIFF_IN_DAYS = 1;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await monastery.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);

				await ethers.provider.send('evm_setNextBlockTimestamp', [timestamp + 21600]);
				await ethers.provider.send('evm_mine', []);

				expect(await monastery.calculateGrantClaim(lepidotteri.address)).to.eq(0);
			});

			it('returns total grant if after duration and none claimed', async () => {
				await monastery.setVotingPowerContract(crown.address);
				await govToken.approve(monastery.address, ethers.constants.MaxUint256);

				const { timestamp } = await ethers.provider.getBlock('latest');
				const decimals = await govToken.decimals();
				const START_TIME = timestamp + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60;
				const VESTING_CLIFF_IN_DAYS = 1;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await monastery.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);

				await ethers.provider.send('evm_setNextBlockTimestamp', [timestamp + 21600 + VESTING_DURATION_IN_SECS]);
				await ethers.provider.send('evm_mine', []);

				expect(await monastery.calculateGrantClaim(lepidotteri.address)).to.eq(grantAmount);
			});

			it('returns remaining grant if after duration and some claimed', async () => {
				await monastery.setVotingPowerContract(crown.address);
				await govToken.approve(monastery.address, ethers.constants.MaxUint256);

				const { timestamp } = await ethers.provider.getBlock('latest');
				const START_TIME = timestamp + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60;
				const VESTING_CLIFF_IN_DAYS = 1;
				const VESTING_CLIFF_IN_SECS = VESTING_CLIFF_IN_DAYS * 24 * 60 * 60;
				const decimals = await govToken.decimals();
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await monastery.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);
				await ethers.provider.send('evm_setNextBlockTimestamp', [timestamp + 21600 + VESTING_CLIFF_IN_SECS * 2]);

				await monastery.claimVestedTokens(lepidotteri.address);

				const amountClaimed = await monastery.claimedBalance(lepidotteri.address);
				await ethers.provider.send('evm_setNextBlockTimestamp', [timestamp + 21600 + VESTING_DURATION_IN_SECS]);
				await ethers.provider.send('evm_mine', []);

				expect(await monastery.calculateGrantClaim(lepidotteri.address)).to.eq(grantAmount.sub(amountClaimed));
			});

			it('returns claimable balance if after cliff and none claimed', async () => {
				await monastery.setVotingPowerContract(crown.address);
				await govToken.approve(monastery.address, ethers.constants.MaxUint256);

				const { timestamp } = await ethers.provider.getBlock('latest');
				const decimals = await govToken.decimals();
				const START_TIME = timestamp + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60;
				const VESTING_CLIFF_IN_DAYS = 1;
				const VESTING_CLIFF_IN_SECS = VESTING_CLIFF_IN_DAYS * 24 * 60 * 60;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await monastery.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);
				const newTime = timestamp + 21600 + VESTING_CLIFF_IN_SECS + 60;

				await ethers.provider.send('evm_setNextBlockTimestamp', [newTime]);
				await ethers.provider.send('evm_mine', []);
				const elapsedTime = newTime - START_TIME;

				expect(await monastery.calculateGrantClaim(lepidotteri.address)).to.eq(
					grantAmount.div(VESTING_DURATION_IN_SECS).mul(elapsedTime)
				);
			});

			it('returns claimable balance if after cliff and some claimed', async () => {
				await monastery.setVotingPowerContract(crown.address);
				await govToken.approve(monastery.address, ethers.constants.MaxUint256);

				const decimals = await govToken.decimals();
				const { timestamp } = await ethers.provider.getBlock('latest');
				const START_TIME = timestamp + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60;
				const VESTING_CLIFF_IN_DAYS = 1;
				const VESTING_CLIFF_IN_SECS = VESTING_CLIFF_IN_DAYS * 24 * 60 * 60;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await monastery.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);

				let newTime = timestamp + 21600 + VESTING_CLIFF_IN_SECS + 60;
				await ethers.provider.send('evm_setNextBlockTimestamp', [newTime]);
				await ethers.provider.send('evm_mine', []);

				await monastery.claimVestedTokens(lepidotteri.address);

				const amountClaimed = await monastery.claimedBalance(lepidotteri.address);
				newTime = timestamp + 21600 + VESTING_CLIFF_IN_SECS + 60 + 60;
				await ethers.provider.send('evm_setNextBlockTimestamp', [newTime]);
				await ethers.provider.send('evm_mine', []);
				const elapsedTime = newTime - START_TIME;

				expect(await monastery.calculateGrantClaim(lepidotteri.address)).to.eq(
					grantAmount.div(VESTING_DURATION_IN_SECS).mul(elapsedTime).sub(amountClaimed)
				);
			});
		});

		context('vestedBalance', async () => {
			it('returns 0 before grant start time', async () => {
				await monastery.setVotingPowerContract(crown.address);
				await govToken.approve(monastery.address, ethers.constants.MaxUint256);

				const decimals = await govToken.decimals();
				const { timestamp } = await ethers.provider.getBlock('latest');
				const START_TIME = timestamp + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_CLIFF_IN_DAYS = 1;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await monastery.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);

				expect(await monastery.vestedBalance(lepidotteri.address)).to.eq(0);
			});

			it('returns 0 before grant cliff', async () => {
				await monastery.setVotingPowerContract(crown.address);
				await govToken.approve(monastery.address, ethers.constants.MaxUint256);

				const decimals = await govToken.decimals();
				const { timestamp } = await ethers.provider.getBlock('latest');
				const START_TIME = timestamp + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_CLIFF_IN_DAYS = 1;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await monastery.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);

				await ethers.provider.send('evm_setNextBlockTimestamp', [timestamp + 21600]);
				await ethers.provider.send('evm_mine', []);

				expect(await monastery.vestedBalance(lepidotteri.address)).to.eq(0);
			});

			it('returns total grant if after duration and none claimed', async () => {
				await monastery.setVotingPowerContract(crown.address);
				await govToken.approve(monastery.address, ethers.constants.MaxUint256);

				const decimals = await govToken.decimals();
				const { timestamp } = await ethers.provider.getBlock('latest');
				const START_TIME = timestamp + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60;
				const VESTING_CLIFF_IN_DAYS = 1;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await monastery.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);
				await ethers.provider.send('evm_setNextBlockTimestamp', [timestamp + 21600 + VESTING_DURATION_IN_SECS]);
				await ethers.provider.send('evm_mine', []);

				expect(await monastery.vestedBalance(lepidotteri.address)).to.eq(grantAmount);
			});

			it('returns total grant if after duration and some claimed', async () => {
				await monastery.setVotingPowerContract(crown.address);
				await govToken.approve(monastery.address, ethers.constants.MaxUint256);

				const decimals = await govToken.decimals();
				const { timestamp } = await ethers.provider.getBlock('latest');
				const START_TIME = timestamp + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60;
				const VESTING_CLIFF_IN_DAYS = 1;
				const VESTING_CLIFF_IN_SECS = VESTING_CLIFF_IN_DAYS * 24 * 60 * 60;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await monastery.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);
				await ethers.provider.send('evm_setNextBlockTimestamp', [timestamp + 21600 + VESTING_CLIFF_IN_SECS * 2]);
				await monastery.claimVestedTokens(lepidotteri.address);
				await ethers.provider.send('evm_setNextBlockTimestamp', [timestamp + 21600 + VESTING_DURATION_IN_SECS]);
				await ethers.provider.send('evm_mine', []);

				expect(await monastery.vestedBalance(lepidotteri.address)).to.eq(grantAmount);
			});

			it('returns vested balance if after cliff and none claimed', async () => {
				await monastery.setVotingPowerContract(crown.address);
				await govToken.approve(monastery.address, ethers.constants.MaxUint256);

				const decimals = await govToken.decimals();
				const { timestamp } = await ethers.provider.getBlock('latest');
				const START_TIME = timestamp + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60;
				const VESTING_CLIFF_IN_DAYS = 1;
				const VESTING_CLIFF_IN_SECS = VESTING_CLIFF_IN_DAYS * 24 * 60 * 60;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await monastery.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);

				const newTime = timestamp + 21600 + VESTING_CLIFF_IN_SECS + 60;
				await ethers.provider.send('evm_setNextBlockTimestamp', [newTime]);
				await ethers.provider.send('evm_mine', []);
				const elapsedTime = newTime - START_TIME;

				expect(await monastery.vestedBalance(lepidotteri.address)).to.eq(grantAmount.div(VESTING_DURATION_IN_SECS).mul(elapsedTime));
			});

			it('returns vested balance if after cliff and some claimed', async () => {
				await monastery.setVotingPowerContract(crown.address);
				await govToken.approve(monastery.address, ethers.constants.MaxUint256);

				const decimals = await govToken.decimals();
				const { timestamp } = await ethers.provider.getBlock('latest');
				const START_TIME = timestamp + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60;
				const VESTING_CLIFF_IN_DAYS = 1;
				const VESTING_CLIFF_IN_SECS = VESTING_CLIFF_IN_DAYS * 24 * 60 * 60;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await monastery.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);

				let newTime = timestamp + 21600 + VESTING_CLIFF_IN_SECS + 60;
				await ethers.provider.send('evm_setNextBlockTimestamp', [newTime]);
				await ethers.provider.send('evm_mine', []);

				await monastery.claimVestedTokens(lepidotteri.address);

				newTime = timestamp + 21600 + VESTING_CLIFF_IN_SECS + 60 + 60;
				await ethers.provider.send('evm_setNextBlockTimestamp', [newTime]);
				await ethers.provider.send('evm_mine', []);
				const elapsedTime = newTime - START_TIME;

				expect(await monastery.vestedBalance(lepidotteri.address)).to.eq(grantAmount.div(VESTING_DURATION_IN_SECS).mul(elapsedTime));
			});
		});

		context('claimVestedTokens', async () => {
			it('does not allow user to claim if no tokens have vested', async () => {
				await monastery.setVotingPowerContract(crown.address);
				await govToken.approve(monastery.address, ethers.constants.MaxUint256);

				const decimals = await govToken.decimals();
				const { timestamp } = await ethers.provider.getBlock('latest');
				const START_TIME = timestamp + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_CLIFF_IN_DAYS = 1;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await monastery.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);

				await expect(monastery.claimVestedTokens(lepidotteri.address)).to.revertedWith(
					'revert Monastery::claimVested: amountVested is 0'
				);
			});

			it('allows user to claim vested tokens once', async () => {
				await monastery.setVotingPowerContract(crown.address);
				await govToken.approve(monastery.address, ethers.constants.MaxUint256);

				const decimals = await govToken.decimals();
				const { timestamp } = await ethers.provider.getBlock('latest');
				const START_TIME = timestamp + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60;
				const VESTING_CLIFF_IN_DAYS = 1;
				const VESTING_CLIFF_IN_SECS = VESTING_CLIFF_IN_DAYS * 24 * 60 * 60;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await monastery.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);
				const userVotingPowerBefore = await crown.votingPowerOf(lepidotteri.address);

				expect(userVotingPowerBefore).to.eq(grantAmount);

				const newTime = timestamp + 21600 + VESTING_CLIFF_IN_SECS + 60;
				const elapsedTime = newTime - START_TIME;
				const claimAmount = grantAmount.div(VESTING_DURATION_IN_SECS).mul(elapsedTime);
				const userTokenBalanceBefore = await govToken.balanceOf(lepidotteri.address);
				const contractTokenBalanceBefore = await govToken.balanceOf(monastery.address);

				await ethers.provider.send('evm_setNextBlockTimestamp', [newTime]);
				await monastery.claimVestedTokens(lepidotteri.address);

				expect(await monastery.claimedBalance(lepidotteri.address)).to.eq(claimAmount);
				expect(await crown.votingPowerOf(lepidotteri.address)).to.eq(userVotingPowerBefore.sub(claimAmount));
				expect(await govToken.balanceOf(lepidotteri.address)).to.eq(userTokenBalanceBefore.add(claimAmount));
				expect(await govToken.balanceOf(monastery.address)).to.eq(contractTokenBalanceBefore.sub(claimAmount));
			});

			it('allows user to claim vested tokens multiple times', async () => {
				await monastery.setVotingPowerContract(crown.address);
				await govToken.approve(monastery.address, ethers.constants.MaxUint256);

				const decimals = await govToken.decimals();
				const { timestamp } = await ethers.provider.getBlock('latest');
				const START_TIME = timestamp + 21600;
				const VESTING_DURATION_IN_DAYS = 9;
				const VESTING_DURATION_IN_SECS = VESTING_DURATION_IN_DAYS * 24 * 60 * 60;
				const VESTING_CLIFF_IN_DAYS = 1;
				const VESTING_CLIFF_IN_SECS = VESTING_CLIFF_IN_DAYS * 24 * 60 * 60;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await monastery.addTokenGrant(lepidotteri.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);
				const userVotingPowerBefore = await crown.votingPowerOf(lepidotteri.address);

				expect(userVotingPowerBefore).to.eq(grantAmount);

				let newTime = timestamp + 21600 + VESTING_CLIFF_IN_SECS + 60;
				let elapsedTime = newTime - START_TIME;
				const claimAmount = grantAmount.div(VESTING_DURATION_IN_SECS).mul(elapsedTime);
				let userTokenBalanceBefore = await govToken.balanceOf(lepidotteri.address);
				let contractTokenBalanceBefore = await govToken.balanceOf(monastery.address);

				await ethers.provider.send('evm_setNextBlockTimestamp', [newTime]);
				await monastery.claimVestedTokens(lepidotteri.address);

				expect(await monastery.claimedBalance(lepidotteri.address)).to.eq(claimAmount);
				expect(await crown.votingPowerOf(lepidotteri.address)).to.eq(userVotingPowerBefore.sub(claimAmount));
				expect(await govToken.balanceOf(lepidotteri.address)).to.eq(userTokenBalanceBefore.add(claimAmount));
				expect(await govToken.balanceOf(monastery.address)).to.eq(contractTokenBalanceBefore.sub(claimAmount));

				newTime = timestamp + 21600 + VESTING_CLIFF_IN_SECS + 60 + 60;
				elapsedTime = newTime - START_TIME;
				const newClaimAmount = grantAmount.div(VESTING_DURATION_IN_SECS).mul(elapsedTime).sub(claimAmount);

				userTokenBalanceBefore = await govToken.balanceOf(lepidotteri.address);
				contractTokenBalanceBefore = await govToken.balanceOf(monastery.address);

				await ethers.provider.send('evm_setNextBlockTimestamp', [newTime]);
				await monastery.claimVestedTokens(lepidotteri.address);

				expect(await monastery.claimedBalance(lepidotteri.address)).to.eq(claimAmount.add(newClaimAmount));
				expect(await crown.votingPowerOf(lepidotteri.address)).to.eq(userVotingPowerBefore.sub(claimAmount).sub(newClaimAmount));
				expect(await govToken.balanceOf(lepidotteri.address)).to.eq(userTokenBalanceBefore.add(newClaimAmount));
				expect(await govToken.balanceOf(monastery.address)).to.eq(contractTokenBalanceBefore.sub(newClaimAmount));
			});
		});

		context('setVotingPowerContract', async () => {
			it('allows owner to set valid voting power contract', async () => {
				await monastery.setVotingPowerContract(crown.address);

				expect(await monastery.votingPower()).to.eq(crown.address);
			});

			it('does not allow non-clergy to set voting power contract', async () => {
				await expect(monastery.connect(Jester).setVotingPowerContract(crown.address)).to.revertedWith(
					'revert Monastery::onlyChurch: not clergy'
				);

				expect(await monastery.votingPower()).to.eq(O_Address);
			});

			it('does not allow owner to set invalid voting power contract', async () => {
				await expect(monastery.setVotingPowerContract(O_Address)).to.revertedWith(
					'revert Monastery::setVotingPowerContract: not valid contract'
				);
				await expect(monastery.setVotingPowerContract(monastery.address)).to.revertedWith(
					'revert Monastery::setVotingPowerContract: not valid contract'
				);
				await expect(monastery.setVotingPowerContract(govToken.address)).to.revertedWith(
					'revert Monastery::setVotingPowerContract: not valid contract'
				);
				expect(await monastery.votingPower()).to.eq(O_Address);
			});
		});

		context('conversion', async () => {
			it('allows clergy to set new valid clergy', async () => {
				await monastery.conversion(lepidotteri.address);

				expect(await monastery.clergy()).to.eq(lepidotteri.address);
			});

			it('does not allow non-clergy to change clergy', async () => {
				await expect(monastery.connect(Jester).conversion(SHA_2048.address)).to.revertedWith(
					'revert Monastery::onlyChurch: not clergy'
				);

				expect(await monastery.clergy()).to.eq(deployer.address);
			});

			it('does not allow clergy to set invalid clergy', async () => {
				await expect(monastery.conversion(O_Address)).to.revertedWith('revert Monastery::conversion: not valid address');
				await expect(monastery.conversion(monastery.address)).to.revertedWith('revert Monastery::conversion: not valid address');
				await expect(monastery.conversion(govToken.address)).to.revertedWith('revert Monastery::conversion: not valid address');

				expect(await monastery.clergy()).to.eq(deployer.address);
			});
		});
	});
});
