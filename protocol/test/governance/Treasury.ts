import { O_Address } from '../../libs/ethereum';
import { Contract } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import { expect } from 'chai';
import { ethers } from 'hardhat';
import { ecsign } from 'ethereumjs-util';

import { rewards } from '../fixtures';
import { getEIP712DomainSeparator, getEIP712PermitDigest } from '../../libs/ethereum';
import { getEnv } from '../../libs/config';

const KINGMAKER_DEPLOYER_PK = getEnv('KINGMAKER_DEPLOYER_PK') || '0x';

describe('Treasury', () => {
	let govToken: Contract;
	let treasury: Contract;
	let lord: Contract;

	let deployer: SignerWithAddress;
	let lepidotteri: SignerWithAddress;
	let SHA_2048: SignerWithAddress;

	beforeEach(async () => {
		const f = await rewards();
		govToken = f.govToken;
		treasury = f.treasury;
		lord = f.lord;
		deployer = f.deployer;
		lepidotteri = f.lepidotteri;
		SHA_2048 = f.SHA_2048;

		await lord.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes('LOCKER_ROLE')), treasury.address);
	});

	context('lockTokens', async () => {
		it('creates valid lock of KING tokens', async () => {
			await govToken.approve(treasury.address, ethers.constants.MaxUint256);
			const decimals = await govToken.decimals();
			const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
			const DURATION_IN_DAYS = 4;
			let totalLocked = await govToken.balanceOf(treasury.address);
			const lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

			await treasury.lockTokens(
				govToken.address,
				deployer.address,
				lepidotteri.address,
				START_TIME,
				lockAmount,
				DURATION_IN_DAYS,
				DURATION_IN_DAYS,
				true
			);

			const activeLocks = await treasury.activeLocks(lepidotteri.address);
			const newLock = activeLocks[0];
			expect(newLock[0]).to.eq(govToken.address);
			expect(newLock[1]).to.eq(lepidotteri.address);
			expect(newLock[2]).to.eq(START_TIME);
			expect(newLock[3]).to.eq(DURATION_IN_DAYS);
			expect(newLock[4]).to.eq(DURATION_IN_DAYS);
			expect(newLock[5]).to.eq(lockAmount);
			expect(newLock[6]).to.eq(0);
			expect(newLock[7]).to.eq(lockAmount);
			totalLocked = totalLocked.add(lockAmount);
			expect(await govToken.balanceOf(treasury.address)).to.eq(totalLocked);
		});

		it('does not allow a lock with a duration of 0', async () => {
			await govToken.approve(treasury.address, ethers.constants.MaxUint256);
			const decimals = await govToken.decimals();
			const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
			const DURATION_IN_DAYS = 0;
			const totalLocked = await govToken.balanceOf(treasury.address);
			const lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

			await expect(
				treasury.lockTokens(
					govToken.address,
					deployer.address,
					SHA_2048.address,
					START_TIME,
					lockAmount,
					DURATION_IN_DAYS,
					DURATION_IN_DAYS,
					false
				)
			).to.revertedWith('revert Treasury::lockTokens: vesting duration must be > 0');

			expect(await govToken.balanceOf(treasury.address)).to.eq(totalLocked);
			const emptyLocks = await treasury.activeLocks(SHA_2048.address);
			expect(emptyLocks.length).to.eq(0);
		});

		it('does not allow a lock with a duration of > 50 years', async () => {
			await govToken.approve(treasury.address, ethers.constants.MaxUint256);
			const decimals = await govToken.decimals();
			const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
			const DURATION_IN_DAYS = 55 * 365;
			const totalLocked = await govToken.balanceOf(treasury.address);
			const lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

			await expect(
				treasury.lockTokens(
					govToken.address,
					deployer.address,
					SHA_2048.address,
					START_TIME,
					lockAmount,
					DURATION_IN_DAYS,
					DURATION_IN_DAYS,
					false
				)
			).to.revertedWith('revert Treasury::lockTokens: vesting duration more than 50 years');
			expect(await govToken.balanceOf(treasury.address)).to.eq(totalLocked);
			const emptyLocks = await treasury.activeLocks(SHA_2048.address);
			expect(emptyLocks.length).to.eq(0);
		});

		it('does not allow a lock of 0', async () => {
			await govToken.approve(treasury.address, ethers.constants.MaxUint256);
			const decimals = await govToken.decimals();
			const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
			const DURATION_IN_DAYS = 4;
			const totalLocked = await govToken.balanceOf(treasury.address);
			const lockAmount = ethers.BigNumber.from(0).mul(ethers.BigNumber.from(10).pow(decimals));
			await expect(
				treasury.lockTokens(
					govToken.address,
					deployer.address,
					SHA_2048.address,
					START_TIME,
					lockAmount,
					DURATION_IN_DAYS,
					DURATION_IN_DAYS,
					false
				)
			).to.revertedWith('revert Treasury::lockTokens: amount not > 0');
			expect(await govToken.balanceOf(treasury.address)).to.eq(totalLocked);
			const emptyLocks = await treasury.activeLocks(SHA_2048.address);
			expect(emptyLocks.length).to.eq(0);
		});

		it('does not allow a lock when locker has insufficient balance', async () => {
			await govToken.approve(treasury.address, ethers.constants.MaxUint256);
			await govToken.transfer(SHA_2048.address, await govToken.balanceOf(deployer.address));
			const decimals = await govToken.decimals();
			const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
			const DURATION_IN_DAYS = 4;
			const totalLocked = await govToken.balanceOf(treasury.address);
			const lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));
			await expect(
				treasury.lockTokens(
					govToken.address,
					deployer.address,
					SHA_2048.address,
					START_TIME,
					lockAmount,
					DURATION_IN_DAYS,
					DURATION_IN_DAYS,
					false
				)
			).to.revertedWith('revert KING::_transferTokens: transfer exceeds from balance');
			expect(await govToken.balanceOf(treasury.address)).to.eq(totalLocked);
			const emptyLocks = await treasury.activeLocks(SHA_2048.address);
			expect(emptyLocks.length).to.eq(0);
		});
	});
	/* TODO: reinstate locking with permit in Treasury.sol#L164
	context('lockTokensWithPermit', async () => {
		xit('creates valid lock of KING tokens', async () => {
			const decimals = await govToken.decimals();
			const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
			const DURATION_IN_DAYS = 4;
			let totalLocked = await govToken.balanceOf(treasury.address);
			const lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));
			const domainSeparator = getEIP712DomainSeparator(await govToken.name(), govToken.address);
			const nonce = await govToken.nonces(deployer.address);
			const deadline = ethers.constants.MaxUint256;
			const digest = getEIP712PermitDigest(domainSeparator, deployer.address, treasury.address, lockAmount, nonce, deadline);

			const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(KINGMAKER_DEPLOYER_PK, 'hex'));

			await treasury.lockTokensWithPermit(
				govToken.address,
				deployer.address,
				lepidotteri.address,
				START_TIME,
				lockAmount,
				DURATION_IN_DAYS,
				0,
				false,
				deadline,
				v,
				r,
				s
			);
			const activeLocks = await treasury.activeLocks(lepidotteri.address);
			const newLock = activeLocks[0];
			expect(newLock[0]).to.eq(govToken.address);
			expect(newLock[1]).to.eq(lepidotteri.address);
			expect(newLock[2]).to.eq(START_TIME);
			expect(newLock[3]).to.eq(DURATION_IN_DAYS);
			expect(newLock[4]).to.eq(0);
			expect(newLock[5]).to.eq(lockAmount);
			expect(newLock[6]).to.eq(0);
			expect(newLock[7]).to.eq(0);
			totalLocked = totalLocked.add(lockAmount);
			expect(await govToken.balanceOf(treasury.address)).to.eq(totalLocked);
		});

		xit('does not allow a lock with a duration of 0', async () => {
			const decimals = await govToken.decimals();
			const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
			const DURATION_IN_DAYS = 0;
			const totalLocked = await govToken.balanceOf(treasury.address);
			const lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));
			const domainSeparator = getEIP712DomainSeparator(await govToken.name(), govToken.address);
			const nonce = await govToken.nonces(deployer.address);
			const deadline = ethers.constants.MaxUint256;
			const digest = getEIP712PermitDigest(domainSeparator, deployer.address, treasury.address, lockAmount, nonce, deadline);

			const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(KINGMAKER_DEPLOYER_PK, 'hex'));

			await expect(
				treasury.lockTokensWithPermit(
					govToken.address,
					deployer.address,
					lepidotteri.address,
					START_TIME,
					lockAmount,
					DURATION_IN_DAYS,
					0,
					false,
					deadline,
					v,
					r,
					s
				)
			).to.revertedWith('revert Treasury::lockTokensWithPermit: vesting duration must be > 0');
			expect(await govToken.balanceOf(treasury.address)).to.eq(totalLocked);
			const emptyLocks = await treasury.activeLocks(SHA_2048.address);
			expect(emptyLocks.length).to.eq(0);
		});

		xit('does not allow a lock with a duration of > 50 years', async () => {
			const decimals = await govToken.decimals();
			const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
			const DURATION_IN_DAYS = 55 * 365;
			const totalLocked = await govToken.balanceOf(treasury.address);
			const lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));
			const domainSeparator = getEIP712DomainSeparator(await govToken.name(), govToken.address);
			const nonce = await govToken.nonces(deployer.address);
			const deadline = ethers.constants.MaxUint256;
			const digest = getEIP712PermitDigest(domainSeparator, deployer.address, treasury.address, lockAmount, nonce, deadline);
			const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(KINGMAKER_DEPLOYER_PK, 'hex'));

			await expect(
				treasury.lockTokensWithPermit(
					govToken.address,
					deployer.address,
					lepidotteri.address,
					START_TIME,
					lockAmount,
					DURATION_IN_DAYS,
					0,
					false,
					deadline,
					v,
					r,
					s
				)
			).to.revertedWith('revert Treasury::lockTokensWithPermit: vesting duration more than 50 years');
			expect(await govToken.balanceOf(treasury.address)).to.eq(totalLocked);
			const emptyLocks = await treasury.activeLocks(SHA_2048.address);
			expect(emptyLocks.length).to.eq(0);
		});

		xit('does not allow a lock of 0', async () => {
			const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
			const DURATION_IN_DAYS = 4;
			const totalLocked = await govToken.balanceOf(treasury.address);
			const lockAmount = ethers.BigNumber.from(0);
			const domainSeparator = getEIP712DomainSeparator(await govToken.name(), govToken.address);
			const nonce = await govToken.nonces(deployer.address);
			const deadline = ethers.constants.MaxUint256;
			const digest = getEIP712PermitDigest(domainSeparator, deployer.address, treasury.address, lockAmount, nonce, deadline);
			const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(KINGMAKER_DEPLOYER_PK, 'hex'));

			await expect(
				treasury.lockTokensWithPermit(
					govToken.address,
					deployer.address,
					lepidotteri.address,
					START_TIME,
					lockAmount,
					DURATION_IN_DAYS,
					0,
					false,
					deadline,
					v,
					r,
					s
				)
			).to.revertedWith('revert Treasury::lockTokensWithPermit: amount not > 0');

			expect(await govToken.balanceOf(treasury.address)).to.eq(totalLocked);
			const emptyLocks = await treasury.activeLocks(SHA_2048.address);
			expect(emptyLocks.length).to.eq(0);
		});

		xit('does not allow a lock when locker has insufficient balance', async () => {
			const decimals = await govToken.decimals();
			const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
			const DURATION_IN_DAYS = 4;
			const totalLocked = await govToken.balanceOf(treasury.address);
			const lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));
			const domainSeparator = getEIP712DomainSeparator(await govToken.name(), govToken.address);
			const nonce = await govToken.nonces(deployer.address);
			const deadline = ethers.constants.MaxUint256;
			const digest = getEIP712PermitDigest(domainSeparator, deployer.address, treasury.address, lockAmount, nonce, deadline);
			const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(KINGMAKER_DEPLOYER_PK, 'hex'));

			await govToken.transfer(SHA_2048.address, await govToken.balanceOf(deployer.address));

			await expect(
				treasury.lockTokensWithPermit(
					govToken.address,
					deployer.address,
					lepidotteri.address,
					START_TIME,
					lockAmount,
					DURATION_IN_DAYS,
					0,
					false,
					deadline,
					v,
					r,
					s
				)
			).to.revertedWith('revert KING::_transferTokens: transfer exceeds from balance');
			expect(await govToken.balanceOf(treasury.address)).to.eq(totalLocked);
			const emptyLocks = await treasury.activeLocks(SHA_2048.address);
			expect(emptyLocks.length).to.eq(0);
		});
	});
*/
	context('tokenBalance', async () => {
		it('returns 0 if locked token balance does not exist', async () => {
			await govToken.approve(treasury.address, ethers.constants.MaxUint256);

			const decimals = await govToken.decimals();
			const { timestamp } = await ethers.provider.getBlock('latest');
			const START_TIME = timestamp + 21600;
			const DURATION_IN_DAYS = 4;
			const lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

			await treasury.lockTokens(govToken.address, deployer.address, SHA_2048.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false);

			const balance = await treasury.tokenBalance(O_Address, SHA_2048.address);
			expect(balance.totalAmount).to.eq(0);
			expect(balance.claimableAmount).to.eq(0);
			expect(balance.claimedAmount).to.eq(0);
			expect(balance.votingPower).to.eq(0);
		});

		it('returns total as claimable amount after lock duration has ended', async () => {
			await govToken.approve(treasury.address, ethers.constants.MaxUint256);

			const decimals = await govToken.decimals();
			const { timestamp } = await ethers.provider.getBlock('latest');
			const START_TIME = timestamp + 21600;
			const DURATION_IN_DAYS = 4;
			const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60;
			const lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

			await treasury.lockTokens(govToken.address, deployer.address, SHA_2048.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false);

			await ethers.provider.send('evm_setNextBlockTimestamp', [START_TIME + DURATION_IN_SECS]);
			await ethers.provider.send('evm_mine', []);

			const balance = await treasury.tokenBalance(govToken.address, SHA_2048.address);
			expect(balance.totalAmount).to.eq(lockAmount);
			expect(balance.claimableAmount).to.eq(lockAmount);
			expect(balance.claimedAmount).to.eq(0);
			expect(balance.votingPower).to.eq(0);
		});

		it('returns 0 claimable if before duration has ended', async () => {
			await govToken.approve(treasury.address, ethers.constants.MaxUint256);

			const decimals = await govToken.decimals();
			const { timestamp } = await ethers.provider.getBlock('latest');
			const START_TIME = timestamp + 21600;
			const DURATION_IN_DAYS = 4;
			const lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

			await treasury.lockTokens(govToken.address, deployer.address, SHA_2048.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false);

			const balance = await treasury.tokenBalance(govToken.address, SHA_2048.address);
			expect(balance.totalAmount).to.eq(lockAmount);
			expect(balance.claimableAmount).to.eq(0);
			expect(balance.claimedAmount).to.eq(0);
			expect(balance.votingPower).to.eq(0);
		});

		it('returns 0 tokens as claimable if before duration has ended (multiple balances)', async () => {
			await govToken.approve(treasury.address, ethers.constants.MaxUint256);

			const decimals = await govToken.decimals();
			const { timestamp } = await ethers.provider.getBlock('latest');
			const START_TIME = timestamp + 21600;
			const DURATION_IN_DAYS = 4;
			const lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

			await treasury.lockTokens(govToken.address, deployer.address, SHA_2048.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false);
			await treasury.lockTokens(govToken.address, deployer.address, SHA_2048.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false);

			const balance = await treasury.tokenBalance(govToken.address, SHA_2048.address);
			expect(balance.totalAmount).to.eq(lockAmount.mul(2));
			expect(balance.claimableAmount).to.eq(0);
			expect(balance.claimedAmount).to.eq(0);
			expect(balance.votingPower).to.eq(0);
		});

		it('returns correct locked tokens for balances at different stages (multiple)', async () => {
			await govToken.approve(treasury.address, ethers.constants.MaxUint256);

			const decimals = await govToken.decimals();
			const { timestamp } = await ethers.provider.getBlock('latest');
			const START_TIME = timestamp + 21600;
			const DURATION_IN_DAYS = 4;
			const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60;
			const lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

			await treasury.lockTokens(
				govToken.address,
				deployer.address,
				SHA_2048.address,
				START_TIME,
				lockAmount,
				DURATION_IN_DAYS,
				DURATION_IN_DAYS,
				false
			);
			await treasury.lockTokens(
				govToken.address,
				deployer.address,
				SHA_2048.address,
				START_TIME,
				lockAmount,
				DURATION_IN_DAYS * 2,
				DURATION_IN_DAYS * 2,
				false
			);

			await ethers.provider.send('evm_setNextBlockTimestamp', [START_TIME + DURATION_IN_SECS]);
			await ethers.provider.send('evm_mine', []);

			const balance = await treasury.tokenBalance(govToken.address, SHA_2048.address);
			expect(balance.totalAmount).to.eq(lockAmount.mul(2));
			expect(balance.claimableAmount).to.eq(lockAmount);
			expect(balance.claimedAmount).to.eq(0);
			expect(balance.votingPower).to.eq(0);
		});
	});

	context('claimableBalance', async () => {
		it('returns 0 before lock start time', async () => {
			await govToken.approve(treasury.address, ethers.constants.MaxUint256);

			const decimals = await govToken.decimals();
			const { timestamp } = await ethers.provider.getBlock('latest');
			const START_TIME = timestamp + 21600;
			const DURATION_IN_DAYS = 4;
			const lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

			await treasury.lockTokens(govToken.address, deployer.address, SHA_2048.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false);

			expect(await treasury.claimableBalance(0)).to.eq(0);
		});

		it('returns 0 at start time', async () => {
			await govToken.approve(treasury.address, ethers.constants.MaxUint256);

			const decimals = await govToken.decimals();
			const { timestamp } = await ethers.provider.getBlock('latest');
			const START_TIME = timestamp + 21600;
			const DURATION_IN_DAYS = 4;
			const lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));
			await treasury.lockTokens(govToken.address, deployer.address, SHA_2048.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false);

			await ethers.provider.send('evm_setNextBlockTimestamp', [START_TIME]);
			await ethers.provider.send('evm_mine', []);

			expect(await treasury.claimableBalance(0)).to.eq(0);
		});

		it('returns 0 if cliff has yet to pass', async () => {
			await govToken.approve(treasury.address, ethers.constants.MaxUint256);

			const decimals = await govToken.decimals();
			const { timestamp } = await ethers.provider.getBlock('latest');
			const START_TIME = timestamp + 21600;
			const DURATION_IN_DAYS = 4;
			const CLIFF_DURATION_IN_DAYS = 2;
			const CLIFF_DURATION_IN_SECS = CLIFF_DURATION_IN_DAYS * 24 * 60 * 60;
			const lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

			await treasury.lockTokens(
				govToken.address,
				deployer.address,
				SHA_2048.address,
				START_TIME,
				lockAmount,
				DURATION_IN_DAYS,
				CLIFF_DURATION_IN_DAYS,
				false
			);

			await ethers.provider.send('evm_setNextBlockTimestamp', [START_TIME + CLIFF_DURATION_IN_SECS - 1]);
			await ethers.provider.send('evm_mine', []);

			expect(await treasury.claimableBalance(0)).to.eq(0);
		});

		it('returns vested amount cliff has passed', async () => {
			await govToken.approve(treasury.address, ethers.constants.MaxUint256);
			const decimals = await govToken.decimals();
			const { timestamp } = await ethers.provider.getBlock('latest');
			const START_TIME = timestamp + 21600;
			const DURATION_IN_DAYS = 4;
			const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60;
			const CLIFF_DURATION_IN_DAYS = 2;
			const CLIFF_DURATION_IN_SECS = CLIFF_DURATION_IN_DAYS * 24 * 60 * 60;
			const lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

			await treasury.lockTokens(
				govToken.address,
				deployer.address,
				SHA_2048.address,
				START_TIME,
				lockAmount,
				DURATION_IN_DAYS,
				CLIFF_DURATION_IN_DAYS,
				false
			);

			await ethers.provider.send('evm_setNextBlockTimestamp', [START_TIME + CLIFF_DURATION_IN_SECS]);
			await ethers.provider.send('evm_mine', []);

			const vestedAmountPerSec = lockAmount.div(DURATION_IN_SECS);
			const vestedAmount = vestedAmountPerSec.mul(CLIFF_DURATION_IN_SECS);
			expect(await treasury.claimableBalance(0)).to.eq(vestedAmount);
		});

		it('returns total unlocked tokens if after duration and none claimed', async () => {
			await govToken.approve(treasury.address, ethers.constants.MaxUint256);

			const decimals = await govToken.decimals();
			const { timestamp } = await ethers.provider.getBlock('latest');
			const START_TIME = timestamp + 21600;
			const DURATION_IN_DAYS = 4;
			const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60;
			const lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

			await treasury.lockTokens(govToken.address, deployer.address, SHA_2048.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false);

			await ethers.provider.send('evm_setNextBlockTimestamp', [START_TIME + DURATION_IN_SECS]);
			await ethers.provider.send('evm_mine', []);

			expect(await treasury.claimableBalance(0)).to.eq(lockAmount);
		});

		it('returns remaining unlocked tokens if after duration and some claimed', async () => {
			await govToken.approve(treasury.address, ethers.constants.MaxUint256);

			const decimals = await govToken.decimals();
			const { timestamp } = await ethers.provider.getBlock('latest');
			const START_TIME = timestamp + 21600;
			const DURATION_IN_DAYS = 4;
			const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60;
			const lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

			await treasury.lockTokens(govToken.address, deployer.address, SHA_2048.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false);
			await ethers.provider.send('evm_setNextBlockTimestamp', [START_TIME + DURATION_IN_SECS]);

			const claimAmount = ethers.BigNumber.from(100).mul(ethers.BigNumber.from(10).pow(decimals));
			await treasury.connect(SHA_2048).claimUnlockedTokenAmounts([0], [claimAmount]);

			expect(await treasury.claimableBalance(0)).to.eq(lockAmount.sub(claimAmount));
		});
	});

	context('claimUnlockedTokenAmounts', async () => {
		it('does not allow user to claim if no tokens are unlocked', async () => {
			await govToken.approve(treasury.address, ethers.constants.MaxUint256);

			const decimals = await govToken.decimals();
			const { timestamp } = await ethers.provider.getBlock('latest');
			const START_TIME = timestamp + 21600;
			const DURATION_IN_DAYS = 4;
			const lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

			await treasury.lockTokens(govToken.address, deployer.address, SHA_2048.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false);

			await expect(treasury.connect(SHA_2048).claimUnlockedTokenAmounts([0], [lockAmount])).to.revertedWith(
				'revert Treasury::claimUnlockedTokenAmounts: claimableAmount < amount'
			);
		});

		it('allows user to claim unlocked tokens once', async () => {
			await govToken.approve(treasury.address, ethers.constants.MaxUint256);
			const decimals = await govToken.decimals();
			const { timestamp } = await ethers.provider.getBlock('latest');
			const START_TIME = timestamp + 21600;
			const DURATION_IN_DAYS = 4;
			const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60;
			const lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

			await treasury.lockTokens(
				govToken.address,
				deployer.address,
				lepidotteri.address,
				START_TIME,
				lockAmount,
				DURATION_IN_DAYS,
				0,
				false
			);

			const userTokenBalanceBefore = await govToken.balanceOf(lepidotteri.address);
			const contractTokenBalanceBefore = await govToken.balanceOf(treasury.address);
			const newTime = timestamp + 21600 + DURATION_IN_SECS + 60;

			await ethers.provider.send('evm_setNextBlockTimestamp', [newTime]);
			await treasury.connect(lepidotteri).claimUnlockedTokenAmounts([0], [lockAmount]);

			expect(await treasury.claimableBalance(0)).to.eq(0);
			expect(await govToken.balanceOf(lepidotteri.address)).to.eq(userTokenBalanceBefore.add(lockAmount));
			expect(await govToken.balanceOf(treasury.address)).to.eq(contractTokenBalanceBefore.sub(lockAmount));
		});

		it('allows user to claim unlocked tokens multiple times', async () => {
			await govToken.approve(treasury.address, ethers.constants.MaxUint256);

			const decimals = await govToken.decimals();
			const { timestamp } = await ethers.provider.getBlock('latest');
			const START_TIME = timestamp + 21600;
			const DURATION_IN_DAYS = 4;
			const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60;
			const lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));
			const aliceBalanceBefore = await govToken.balanceOf(lepidotteri.address);

			await treasury.lockTokens(
				govToken.address,
				deployer.address,
				lepidotteri.address,
				START_TIME,
				lockAmount,
				DURATION_IN_DAYS,
				0,
				false
			);

			const userTokenBalanceBefore = await govToken.balanceOf(lepidotteri.address);
			const contractTokenBalanceBefore = await govToken.balanceOf(treasury.address);
			const newTime = timestamp + 21600 + DURATION_IN_SECS + 60;

			await ethers.provider.send('evm_setNextBlockTimestamp', [newTime]);
			const claimAmount = ethers.BigNumber.from(100).mul(ethers.BigNumber.from(10).pow(decimals));

			await treasury.connect(lepidotteri).claimUnlockedTokenAmounts([0], [claimAmount]);
			expect(await treasury.claimableBalance(0)).to.eq(lockAmount.sub(claimAmount));
			expect(await govToken.balanceOf(lepidotteri.address)).to.eq(userTokenBalanceBefore.add(claimAmount));
			expect(await govToken.balanceOf(treasury.address)).to.eq(contractTokenBalanceBefore.sub(claimAmount));

			await treasury.connect(lepidotteri).claimUnlockedTokenAmounts([0], [claimAmount]);
			expect(await treasury.claimableBalance(0)).to.eq(lockAmount.sub(claimAmount.mul(2)));
			expect(await govToken.balanceOf(lepidotteri.address)).to.eq(userTokenBalanceBefore.add(claimAmount.mul(2)));
			expect(await govToken.balanceOf(treasury.address)).to.eq(contractTokenBalanceBefore.sub(claimAmount.mul(2)));

			await treasury.connect(lepidotteri).claimUnlockedTokenAmounts([0], [lockAmount.sub(claimAmount.mul(2))]);
			expect(await treasury.claimableBalance(0)).to.eq(0);
			expect(await govToken.balanceOf(lepidotteri.address)).to.eq(aliceBalanceBefore.add(lockAmount));
			expect(await govToken.balanceOf(treasury.address)).to.eq(0);
		});
	});

	context('claimAllUnlockedTokens', async () => {
		it('does not allow user to claim if no tokens are unlocked', async () => {
			await govToken.approve(treasury.address, ethers.constants.MaxUint256);

			const decimals = await govToken.decimals();
			const { timestamp } = await ethers.provider.getBlock('latest');
			const START_TIME = timestamp + 21600;
			const DURATION_IN_DAYS = 4;
			const lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

			await treasury.lockTokens(govToken.address, deployer.address, SHA_2048.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false);

			await expect(treasury.connect(SHA_2048).claimAllUnlockedTokens([0])).to.revertedWith(
				'revert Treasury::claimAllUnlockedTokens: claimableAmount is 0'
			);
		});

		it('allows user to claim unlocked tokens once', async () => {
			await govToken.approve(treasury.address, ethers.constants.MaxUint256);

			const decimals = await govToken.decimals();
			const { timestamp } = await ethers.provider.getBlock('latest');
			const START_TIME = timestamp + 21600;
			const DURATION_IN_DAYS = 4;
			const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60;
			const lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

			await treasury.lockTokens(
				govToken.address,
				deployer.address,
				lepidotteri.address,
				START_TIME,
				lockAmount,
				DURATION_IN_DAYS,
				0,
				false
			);

			const userTokenBalanceBefore = await govToken.balanceOf(lepidotteri.address);
			const contractTokenBalanceBefore = await govToken.balanceOf(treasury.address);
			const newTime = timestamp + 21600 + DURATION_IN_SECS + 60;

			await ethers.provider.send('evm_setNextBlockTimestamp', [newTime]);
			await treasury.connect(lepidotteri).claimAllUnlockedTokens([0]);

			expect(await treasury.claimableBalance(0)).to.eq(0);
			expect(await govToken.balanceOf(lepidotteri.address)).to.eq(userTokenBalanceBefore.add(lockAmount));
			expect(await govToken.balanceOf(treasury.address)).to.eq(contractTokenBalanceBefore.sub(lockAmount));
		});

		it('does not allow user to claim unlocked tokens multiple times', async () => {
			await govToken.approve(treasury.address, ethers.constants.MaxUint256);

			const decimals = await govToken.decimals();
			const { timestamp } = await ethers.provider.getBlock('latest');
			const START_TIME = timestamp + 21600;
			const DURATION_IN_DAYS = 4;
			const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60;
			const aliceBalanceBefore = await govToken.balanceOf(lepidotteri.address);
			const lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

			await treasury.lockTokens(
				govToken.address,
				deployer.address,
				lepidotteri.address,
				START_TIME,
				lockAmount,
				DURATION_IN_DAYS,
				0,
				false
			);

			const newTime = timestamp + 21600 + DURATION_IN_SECS + 60;
			await ethers.provider.send('evm_setNextBlockTimestamp', [newTime]);

			await treasury.connect(lepidotteri).claimAllUnlockedTokens([0]);
			expect(await treasury.claimableBalance(0)).to.eq(0);
			expect(await govToken.balanceOf(lepidotteri.address)).to.eq(aliceBalanceBefore.add(lockAmount));
			expect(await govToken.balanceOf(treasury.address)).to.eq(0);

			await expect(treasury.connect(lepidotteri).claimAllUnlockedTokens([0])).to.revertedWith(
				'revert Treasury::claimAllUnlockedTokens: claimableAmount is 0'
			);
		});
	});

	context('extendLock', async () => {
		it('allows receiver to extend a lock', async () => {
			await govToken.approve(treasury.address, ethers.constants.MaxUint256);
			const decimals = await govToken.decimals();
			const { timestamp } = await ethers.provider.getBlock('latest');
			const START_TIME = timestamp + 21600;
			const ORIGINAL_DURATION_IN_DAYS = 4;
			const SIX_MONTHS_IN_DAYS = 6 * 30;
			const lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));
			await treasury.lockTokens(
				govToken.address,
				deployer.address,
				SHA_2048.address,
				START_TIME,
				lockAmount,
				ORIGINAL_DURATION_IN_DAYS,
				0,
				false
			);
			let lock = await treasury.tokenLocks(0);
			expect(lock.vestingDurationInDays).to.eq(ORIGINAL_DURATION_IN_DAYS);

			await treasury.connect(SHA_2048).extendLock(0, SIX_MONTHS_IN_DAYS, 0);

			lock = await treasury.tokenLocks(0);
			expect(lock.vestingDurationInDays).to.eq(ORIGINAL_DURATION_IN_DAYS + SIX_MONTHS_IN_DAYS);
		});

		it('does not allow non-receiver to extend a lock', async () => {
			await govToken.approve(treasury.address, ethers.constants.MaxUint256);

			const decimals = await govToken.decimals();
			const { timestamp } = await ethers.provider.getBlock('latest');
			const START_TIME = timestamp + 21600;
			const ORIGINAL_DURATION_IN_DAYS = 4;
			const SIX_MONTHS_IN_DAYS = 6 * 30;

			const lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));
			await treasury.lockTokens(
				govToken.address,
				deployer.address,
				SHA_2048.address,
				START_TIME,
				lockAmount,
				ORIGINAL_DURATION_IN_DAYS,
				0,
				false
			);

			let lock = await treasury.tokenLocks(0);

			expect(lock.vestingDurationInDays).to.eq(ORIGINAL_DURATION_IN_DAYS);
			await expect(treasury.extendLock(0, SIX_MONTHS_IN_DAYS, 0)).to.revertedWith('Treasury::extendLock: msg.sender must be receiver');

			lock = await treasury.tokenLocks(0);

			expect(lock.vestingDurationInDays).to.eq(ORIGINAL_DURATION_IN_DAYS);
		});

		it('does not allow receiver to overflow lock', async () => {
			await govToken.approve(treasury.address, ethers.constants.MaxUint256);

			const decimals = await govToken.decimals();
			const { timestamp } = await ethers.provider.getBlock('latest');
			const START_TIME = timestamp + 21600;
			const ORIGINAL_DURATION_IN_DAYS = 4;
			const lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

			await treasury.lockTokens(
				govToken.address,
				deployer.address,
				SHA_2048.address,
				START_TIME,
				lockAmount,
				ORIGINAL_DURATION_IN_DAYS,
				0,
				false
			);
			let lock = await treasury.tokenLocks(0);

			expect(lock.vestingDurationInDays).to.eq(ORIGINAL_DURATION_IN_DAYS);
			await expect(treasury.connect(SHA_2048).extendLock(0, 65535, 0)).to.revertedWith(
				'revert Treasury::extendLock: vesting max days exceeded'
			);

			lock = await treasury.tokenLocks(0);

			expect(lock.vestingDurationInDays).to.eq(ORIGINAL_DURATION_IN_DAYS);
		});
	});
});
