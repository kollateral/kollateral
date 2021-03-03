import { Contract } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import { expect } from 'chai';
import { ethers } from 'hardhat';
import { ecsign } from 'ethereumjs-util';

import { governanceFixture } from '../fixtures';
import { getEnv } from '../../libs/config';
import { getEIP712DomainSeparator, getEIP712PermitDigest } from '../../libs/ethereum';

const KINGMAKER_DEPLOYER_PK = getEnv('KINGMAKER_DEPLOYER_PK') || '0x';

describe('Multisend', () => {
	let govToken: Contract;
	let multisend: Contract;

	let deployer: SignerWithAddress;
	let lepidotteri: SignerWithAddress;
	let SHA_2048: SignerWithAddress;

	beforeEach(async () => {
		const f = await governanceFixture();
		govToken = f.govToken;
		multisend = f.multisend;
		deployer = f.deployer;
		lepidotteri = f.lepidotteri;
		SHA_2048 = f.SHA_2048;
	});

	context('batchTransfer', async () => {
		it('allows a single valid transfer in batch', async () => {
			const amount = 100;
			const senderBalanceBefore = await govToken.balanceOf(deployer.address);
			const receiverBalanceBefore = await govToken.balanceOf(SHA_2048.address);

			await govToken.approve(multisend.address, amount);

			expect(await govToken.allowance(deployer.address, multisend.address)).to.eq(amount);

			await multisend.batchTransfer(amount, [lepidotteri.address], [amount]);

			expect(await govToken.balanceOf(deployer.address)).to.eq(senderBalanceBefore.sub(amount));
			expect(await govToken.balanceOf(lepidotteri.address)).to.eq(receiverBalanceBefore.add(amount));
			expect(await govToken.allowance(deployer.address, multisend.address)).to.eq(0);
		});

		it('allows multiple valid transfers in batch', async () => {
			const amountPerTransfer = 100;
			const numTransfers = 2;
			const totalAmount = amountPerTransfer * numTransfers;
			const senderBalanceBefore = await govToken.balanceOf(deployer.address);
			const lepidotteriBalanceBefore = await govToken.balanceOf(lepidotteri.address);
			const SHA_2048BalanceBefore = await govToken.balanceOf(SHA_2048.address);

			await govToken.approve(multisend.address, totalAmount);

			expect(await govToken.allowance(deployer.address, multisend.address)).to.eq(totalAmount);

			await multisend.batchTransfer(totalAmount, [lepidotteri.address, SHA_2048.address], [amountPerTransfer, amountPerTransfer]);

			expect(await govToken.balanceOf(deployer.address)).to.eq(senderBalanceBefore.sub(totalAmount));
			expect(await govToken.balanceOf(lepidotteri.address)).to.eq(lepidotteriBalanceBefore.add(amountPerTransfer));
			expect(await govToken.balanceOf(SHA_2048.address)).to.eq(SHA_2048BalanceBefore.add(amountPerTransfer));
			expect(await govToken.allowance(deployer.address, multisend.address)).to.eq(0);
		});

		it('cannot transfer in excess of the total contract allowance when performing batch transfer', async () => {
			const amountPerTransfer = 100;
			const numTransfers = 2;
			const totalAmount = amountPerTransfer * numTransfers;
			const senderBalanceBefore = await govToken.balanceOf(deployer.address);
			const lepidotteriBalanceBefore = await govToken.balanceOf(lepidotteri.address);
			const SHA_2048BalanceBefore = await govToken.balanceOf(SHA_2048.address);

			await govToken.approve(multisend.address, amountPerTransfer);

			await expect(
				multisend.batchTransfer(totalAmount, [lepidotteri.address, SHA_2048.address], [amountPerTransfer, amountPerTransfer])
			).to.revertedWith('revert Multisend::_batchTransfer: allowance too low');
			expect(await govToken.balanceOf(deployer.address)).to.eq(senderBalanceBefore);
			expect(await govToken.balanceOf(lepidotteri.address)).to.eq(lepidotteriBalanceBefore);
			expect(await govToken.balanceOf(SHA_2048.address)).to.eq(SHA_2048BalanceBefore);
			expect(await govToken.allowance(deployer.address, multisend.address)).to.eq(amountPerTransfer);
		});

		it('cannot pass in recipients and amounts with different lengths', async () => {
			const amountPerTransfer = 100;

			await govToken.approve(multisend.address, amountPerTransfer);

			await expect(
				multisend.batchTransfer(amountPerTransfer, [lepidotteri.address, SHA_2048.address], [amountPerTransfer])
			).to.revertedWith('revert Multisend::_batchTransfer: recipients length != amounts length');
		});

		it('cannot pass in a total amount that is different from the transferred total', async () => {
			const amountPerTransfer = 100;
			const numTransfers = 2;
			const totalAmount = amountPerTransfer * numTransfers;
			const tooMuch = totalAmount + 1;

			await govToken.approve(multisend.address, tooMuch);

			await expect(
				multisend.batchTransfer(tooMuch, [lepidotteri.address, SHA_2048.address], [amountPerTransfer, amountPerTransfer])
			).to.revertedWith('revert Multisend::_batchTransfer: total != transferred amount');
		});
	});

	context('batchTransferWithPermit', async () => {
		it('allows a single valid transfer in batch', async () => {
			const amount = 100;
			const domainSeparator = getEIP712DomainSeparator(await govToken.name(), govToken.address);
			const nonce = await govToken.nonces(deployer.address);
			const deadline = ethers.constants.MaxUint256;
			const digest = getEIP712PermitDigest(domainSeparator, deployer.address, multisend.address, amount, nonce, deadline);
			const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(KINGMAKER_DEPLOYER_PK, 'hex'));
			const senderBalanceBefore = await govToken.balanceOf(deployer.address);
			const receiverBalanceBefore = await govToken.balanceOf(SHA_2048.address);

			await multisend.batchTransferWithPermit(amount, [lepidotteri.address], [amount], deadline, v, r, s);

			expect(await govToken.balanceOf(deployer.address)).to.eq(senderBalanceBefore.sub(amount));
			expect(await govToken.balanceOf(lepidotteri.address)).to.eq(receiverBalanceBefore.add(amount));
			expect(await govToken.allowance(deployer.address, multisend.address)).to.eq(0);
		});

		it('allows multiple valid transfers in batch', async () => {
			const amountPerTransfer = 100;
			const numTransfers = 2;
			const totalAmount = amountPerTransfer * numTransfers;
			const senderBalanceBefore = await govToken.balanceOf(deployer.address);
			const lepidotteriBalanceBefore = await govToken.balanceOf(lepidotteri.address);
			const SHA_2048BalanceBefore = await govToken.balanceOf(SHA_2048.address);
			const domainSeparator = getEIP712DomainSeparator(await govToken.name(), govToken.address);
			const nonce = await govToken.nonces(deployer.address);
			const deadline = ethers.constants.MaxUint256;
			const digest = getEIP712PermitDigest(domainSeparator, deployer.address, multisend.address, totalAmount, nonce, deadline);
			const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(KINGMAKER_DEPLOYER_PK, 'hex'));

			await multisend.batchTransferWithPermit(
				totalAmount,
				[lepidotteri.address, SHA_2048.address],
				[amountPerTransfer, amountPerTransfer],
				deadline,
				v,
				r,
				s
			);

			expect(await govToken.balanceOf(deployer.address)).to.eq(senderBalanceBefore.sub(totalAmount));
			expect(await govToken.balanceOf(lepidotteri.address)).to.eq(lepidotteriBalanceBefore.add(amountPerTransfer));
			expect(await govToken.balanceOf(SHA_2048.address)).to.eq(SHA_2048BalanceBefore.add(amountPerTransfer));
			expect(await govToken.allowance(deployer.address, multisend.address)).to.eq(0);
		});

		it('does not allow permit intended for user directly instead of contract', async () => {
			const amount = 100;
			const domainSeparator = getEIP712DomainSeparator(await govToken.name(), govToken.address);
			const nonce = await govToken.nonces(deployer.address);
			const deadline = ethers.constants.MaxUint256;
			const digest = getEIP712PermitDigest(domainSeparator, deployer.address, lepidotteri.address, amount, nonce, deadline);
			const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(KINGMAKER_DEPLOYER_PK, 'hex'));

			await expect(multisend.batchTransferWithPermit(amount, [lepidotteri.address], [amount], deadline, v, r, s)).to.revertedWith('');
		});
	});
});
