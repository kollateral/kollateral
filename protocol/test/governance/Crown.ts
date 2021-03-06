import { expect } from 'chai';
import { ethers } from 'hardhat';
import { ecsign } from 'ethereumjs-util';

import { governance } from '../fixtures';
import { getEnv } from '../../libs/config';
import { Contract } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { getEIP712DomainSeparator, getEIP712PermitDigest, O_Address } from '../../libs/ethereum';

const KINGMAKER_DEPLOYER_PK = getEnv('KINGMAKER_DEPLOYER_PK') || '0x';

describe('Crown', () => {
	let govToken: Contract;
	let monastery: Contract;
	let crown: Contract;
	let crownPrism: Contract;
	let crownImp: Contract;

	let deployer: SignerWithAddress;
	let admin: SignerWithAddress;
	let lepidotteri: SignerWithAddress;
	let SHA_2048: SignerWithAddress;

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
	});

	context('Pre-init', async () => {
		context('govToken', async () => {
			it('reverts', async () => {
				await expect(crown.govToken()).to.reverted;
			});
		});
	});

	context('Post-init', async () => {
		beforeEach(async () => {
			await crownPrism.setPendingProxyImplementation(crownImp.address);
			await crownImp.become(crownPrism.address);
			await crown.initialize(govToken.address, monastery.address);
		});

		context('govToken', async () => {
			it('returns the current KING token address', async () => {
				expect(await crown.govToken()).to.eq(govToken.address);
				expect(await crownImp.govToken()).to.eq(O_Address);
			});
		});

		context('decimals', async () => {
			it('returns the correct decimals for voting power', async () => {
				expect(await crown.votingDecimals()).to.eq(18);
			});
		});

		context('vestingContract', async () => {
			it('returns the current vesting contract address', async () => {
				expect(await crown.vestingContract()).to.eq(monastery.address);
				expect(await crownImp.vestingContract()).to.eq(O_Address);
			});
		});

		context('stake', async () => {
			it('allows a valid stake', async () => {
				const userBalanceBefore = await govToken.balanceOf(deployer.address);
				const contractBalanceBefore = await govToken.balanceOf(crown.address);
				const totalKINGStakedBefore = await crown.getGovernanceTokenAmountStaked(deployer.address);
				const userVotesBefore = await crown.votingPowerOf(deployer.address);

				await govToken.approve(crown.address, 1000);
				await crown['stake(uint256)'](1000);

				expect(await govToken.balanceOf(deployer.address)).to.eq(userBalanceBefore.sub(1000));
				expect(await govToken.balanceOf(crown.address)).to.eq(contractBalanceBefore.add(1000));
				expect(await crown.getGovernanceTokenAmountStaked(deployer.address)).to.eq(totalKINGStakedBefore.add(1000));
				expect(await crown.votingPowerOf(deployer.address)).to.eq(userVotesBefore.add(1000));
			});

			it('does not allow a zero stake amount', async () => {
				await expect(crown['stake(uint256)'](0)).to.revertedWith('revert Crown::stake: cannot stake 0');
			});

			it('does not allow a user to stake more tokens than they have', async () => {
				await expect(crown.connect(lepidotteri)['stake(uint256)'](1000)).to.revertedWith('revert Crown::stake: not enough tokens');
			});

			it('does not allow a user to stake before approval', async () => {
				await expect(crown['stake(uint256)'](1000)).to.revertedWith('revert Crown::stake: must approve tokens before staking');
			});
		});

		context('stakeWithPermit', async () => {
			it('allows a valid stake with permit', async () => {
				const value = 1000;
				const userBalanceBefore = await govToken.balanceOf(deployer.address);
				const contractBalanceBefore = await govToken.balanceOf(crown.address);
				const totalKINGStakedBefore = await crown.getGovernanceTokenAmountStaked(deployer.address);
				const userVotesBefore = await crown.votingPowerOf(deployer.address);
				const domainSeparator = getEIP712DomainSeparator(await govToken.name(), govToken.address);
				const nonce = await govToken.nonces(deployer.address);
				const deadline = ethers.constants.MaxUint256;
				const digest = getEIP712PermitDigest(domainSeparator, deployer.address, crown.address, value, nonce, deadline);
				const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(KINGMAKER_DEPLOYER_PK, 'hex'));

				await crown.stakeWithPermit(value, deadline, v, r, s);

				expect(await govToken.balanceOf(deployer.address)).to.eq(userBalanceBefore.sub(value));
				expect(await govToken.balanceOf(crown.address)).to.eq(contractBalanceBefore.add(value));
				expect(await crown.getGovernanceTokenAmountStaked(deployer.address)).to.eq(totalKINGStakedBefore.add(value));
				expect(await crown.votingPowerOf(deployer.address)).to.eq(userVotesBefore.add(value));
			});

			it('does not allow a zero stake amount', async () => {
				const value = 0;
				const domainSeparator = getEIP712DomainSeparator(await govToken.name(), govToken.address);
				const nonce = await govToken.nonces(deployer.address);
				const deadline = ethers.constants.MaxUint256;
				const digest = getEIP712PermitDigest(domainSeparator, lepidotteri.address, crown.address, value, nonce, deadline);
				const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(KINGMAKER_DEPLOYER_PK, 'hex'));

				await expect(crown.stakeWithPermit(value, deadline, v, r, s)).to.revertedWith('revert Crown::stakeWithPermit: cannot stake 0');
			});

			it('does not allow a user to stake using a permit signed by someone else', async () => {
				const value = 1000;
				const domainSeparator = getEIP712DomainSeparator(await govToken.name(), govToken.address);
				const nonce = await govToken.nonces(lepidotteri.address);
				const deadline = ethers.constants.MaxUint256;
				const digest = getEIP712PermitDigest(domainSeparator, lepidotteri.address, crown.address, value, nonce, deadline);
				const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(KINGMAKER_DEPLOYER_PK, 'hex'));

				await expect(crown.stakeWithPermit(value, deadline, v, r, s)).to.revertedWith('revert KING::validateSig: invalid signature');
			});

			it('does not allow a user to stake more tokens than they have', async () => {
				const value = 1000;
				const domainSeparator = getEIP712DomainSeparator(await govToken.name(), govToken.address);
				const nonce = await govToken.nonces(lepidotteri.address);
				const deadline = ethers.constants.MaxUint256;
				const digest = getEIP712PermitDigest(domainSeparator, lepidotteri.address, crown.address, value, nonce, deadline);
				const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(KINGMAKER_DEPLOYER_PK, 'hex'));

				await expect(crown.connect(lepidotteri).stakeWithPermit(value, deadline, v, r, s)).to.revertedWith(
					'revert Crown::stakeWithPermit: not enough tokens'
				);
			});
		});

		context('addVotingPowerForVestingTokens', async () => {
			it('does not allow user to add 0 voting power', async () => {
				await expect(crown.addVotingPowerForVestingTokens(lepidotteri.address, 0)).to.revertedWith(
					'revert Crown::addVPforVT: cannot add 0 voting power'
				);
			});

			it('does not allow addresses other than the monastery contract to add voting power', async () => {
				await expect(crown.addVotingPowerForVestingTokens(lepidotteri.address, 1000)).to.revertedWith(
					'revert Crown::addVPforVT: only Monastery contract'
				);
			});
		});

		context('removeVotingPowerForClaimedTokens', async () => {
			it('does not allow user to remove 0 voting power', async () => {
				await expect(crown.removeVotingPowerForClaimedTokens(lepidotteri.address, 0)).to.revertedWith(
					'revert Crown::removeVPforCT: cannot remove 0 voting power'
				);
			});

			it('does not allow addresses other than the vesting contract to remove voting power', async () => {
				await expect(crown.removeVotingPowerForClaimedTokens(lepidotteri.address, 1000)).to.revertedWith(
					'revert Crown::removeVPforCT: only Monastery contract'
				);
			});
		});

		context('withdraw', async () => {
			it('allows a valid withdrawal', async () => {
				const userBalanceBefore = await govToken.balanceOf(deployer.address);
				const contractBalanceBefore = await govToken.balanceOf(crown.address);
				const totalKINGStakedBefore = await crown.getGovernanceTokenAmountStaked(deployer.address);
				const userVotesBefore = await crown.votingPowerOf(deployer.address);
				await govToken.approve(crown.address, 1000);
				await crown['stake(uint256)'](1000);

				expect(await govToken.balanceOf(deployer.address)).to.eq(userBalanceBefore.sub(1000));
				expect(await govToken.balanceOf(crown.address)).to.eq(contractBalanceBefore.add(1000));
				expect(await crown.getGovernanceTokenAmountStaked(deployer.address)).to.eq(totalKINGStakedBefore.add(1000));

				const userVotesAfter = await crown.votingPowerOf(deployer.address);

				expect(userVotesAfter).to.eq(userVotesBefore.add(1000));

				await crown['withdraw(uint256)'](1000);

				expect(await govToken.balanceOf(deployer.address)).to.eq(userBalanceBefore);
				expect(await govToken.balanceOf(crown.address)).to.eq(contractBalanceBefore);
				expect(await crown.getGovernanceTokenAmountStaked(deployer.address)).to.eq(totalKINGStakedBefore);
				expect(await crown.votingPowerOf(deployer.address)).to.eq(0);
			});

			it('does not allow a zero-amount withdrawal', async () => {
				await expect(crown['withdraw(uint256)'](0)).to.revertedWith('revert Crown::withdraw: cannot withdraw 0');
			});

			it('does not allow a user to withdraw more than their current stake', async () => {
				await govToken.approve(crown.address, 1000);
				await crown['stake(uint256)'](1000);

				await expect(crown['withdraw(uint256)'](1001)).to.revertedWith('revert Crown::_withdraw: not enough tokens staked');
			});

			it('does not allow a user to withdraw more than they have staked when they have vested tokens', async () => {
				const decimals = await govToken.decimals();
				const START_TIME = parseInt(String(Date.now() / 1000)) + 21600;
				const VESTING_DURATION_IN_DAYS = 4;
				const VESTING_CLIFF_IN_DAYS = 1;
				const grantAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals));

				await govToken.approve(crown.address, 1000);
				await crown['stake(uint256)'](1000);
				await monastery.setVotingPowerContract(crown.address);
				await govToken.approve(monastery.address, ethers.constants.MaxUint256);
				await monastery.addTokenGrant(deployer.address, START_TIME, grantAmount, VESTING_DURATION_IN_DAYS, VESTING_CLIFF_IN_DAYS);

				await expect(crown['withdraw(uint256)'](2000)).to.revertedWith('revert Crown::_withdraw: not enough tokens staked');
			});
		});
	});
});
