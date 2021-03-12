import { Contract } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import { expect } from 'chai';
import { ethers } from 'hardhat';
// @ts-ignore
import { ecsign } from 'ethereumjs-util';

import { token } from '../fixtures';
import { getEnv } from '../../libs/config';
import {
	getEIP712DomainSeparator,
	getEIP712PermitDigest,
	getEIP712ReceiveWithAuthDigest,
	getEIP712TransferWithAuthDigest,
	O_Address,
} from '../../libs/ethereum';

const KINGMAKER_DEPLOYER_PK = getEnv('KINGMAKER_DEPLOYER_PK') || '0x';

describe('KING', () => {
	let govToken: Contract;

	let deployer: SignerWithAddress;
	let admin: SignerWithAddress;
	let lepidotteri: SignerWithAddress;
	let SHA_2048: SignerWithAddress;
	let Jester: SignerWithAddress;

	beforeEach(async () => {
		const f = await token();
		govToken = f.govToken;
		deployer = f.deployer;
		admin = f.admin;
		lepidotteri = f.lepidotteri;
		SHA_2048 = f.SHA_2048;
		Jester = f.Jester;
	});

	context('symbol', async () => {
		it('should not be the unicode symbol ♚', async () => {
			const symbol = await govToken.symbol();
			expect(symbol).to.equal('KING');
			expect(symbol).to.not.equal('♚');
		});
	});

	context('setSupplyManager', async () => {
		it('can set a new valid supply manager', async () => {
			await govToken.setSupplyManager(SHA_2048.address);
			expect(await govToken.supplyManager()).to.equal(SHA_2048.address);
		});

		it('only supply manager can set a new supply manager', async () => {
			await expect(govToken.connect(lepidotteri).setSupplyManager(SHA_2048.address)).to.revertedWith(
				'revert KING::setSupplyManager: only SM can change SM'
			);
		});
	});

	context('setMetadataManager', async () => {
		it('can set a new valid metadata manager', async () => {
			await govToken.connect(admin).setMetadataManager(SHA_2048.address);
			expect(await govToken.metadataManager()).to.equal(SHA_2048.address);
		});

		it('only metadata manager can set a new metadata manager', async () => {
			await expect(govToken.connect(Jester).setMetadataManager(SHA_2048.address)).to.revertedWith(
				'revert KING::setMetadataManager: only MM can change MM'
			);
		});
	});

	context('setMintCap', async () => {
		it('can set a new valid mint cap', async () => {
			await govToken.setMintCap(0);
			expect(await govToken.mintCap()).to.equal(0);
		});

		it('only supply manager can set a new mint cap', async () => {
			await expect(govToken.connect(lepidotteri).setMintCap(0)).to.revertedWith('revert KING::setMintCap: only SM can change mint cap');
		});
	});

	context('setSupplyChangeWaitingPeriod', async () => {
		it('can set a new valid supply change waiting period', async () => {
			const waitingPeriodMinimum = await govToken.supplyChangeWaitingPeriodMinimum();
			await govToken.setSupplyChangeWaitingPeriod(waitingPeriodMinimum);
			expect(await govToken.supplyChangeWaitingPeriod()).to.equal(waitingPeriodMinimum);
		});

		it('only supply manager can set a new supply change waiting period', async () => {
			const waitingPeriodMinimum = await govToken.supplyChangeWaitingPeriodMinimum();
			await expect(govToken.connect(lepidotteri).setSupplyChangeWaitingPeriod(waitingPeriodMinimum)).to.revertedWith(
				'revert KING::setSupplyChangeWaitingPeriod: only SM can change waiting period'
			);
		});

		it('waiting period must be > minimum', async () => {
			await expect(govToken.setSupplyChangeWaitingPeriod(0)).to.revertedWith(
				'revert KING::setSupplyChangeWaitingPeriod: waiting period must be > minimum'
			);
		});
	});

	context('updateTokenMetadata', async () => {
		it('metadata manager can update token metadata', async () => {
			await govToken.connect(admin).updateTokenMetadata('New Token', 'NEW');
			expect(await govToken.name()).to.equal('New Token');
			expect(await govToken.symbol()).to.equal('NEW');
		});

		it('only metadata manager can update token metadata', async () => {
			await expect(govToken.connect(Jester).updateTokenMetadata('New Token', 'NEW')).to.revertedWith(
				'revert KING::updateTokenMeta: only MM can update token metadata'
			);
		});
	});

	context('transfer', async () => {
		it('allows a valid transfer', async () => {
			const amount = 900;
			const balanceBefore = await govToken.balanceOf(lepidotteri.address);

			await govToken.transfer(lepidotteri.address, amount);

			expect(await govToken.balanceOf(lepidotteri.address)).to.eq(balanceBefore.add(amount));
		});

		it('does not allow a transfer to the zero address', async () => {
			const amount = 900;

			await expect(govToken.transfer(O_Address, amount)).to.revertedWith('KING::_transferTokens: cannot transfer to the zero address');
		});
	});

	context('transferFrom', async () => {
		it('allows a valid transferFrom', async () => {
			const amount = 900;
			const senderBalanceBefore = await govToken.balanceOf(deployer.address);
			const receiverBalanceBefore = await govToken.balanceOf(SHA_2048.address);

			await govToken.approve(lepidotteri.address, amount);

			expect(await govToken.allowance(deployer.address, lepidotteri.address)).to.eq(amount);

			await govToken.connect(lepidotteri).transferFrom(deployer.address, SHA_2048.address, amount);

			expect(await govToken.balanceOf(deployer.address)).to.eq(senderBalanceBefore.sub(amount));
			expect(await govToken.balanceOf(SHA_2048.address)).to.eq(receiverBalanceBefore.add(amount));
			expect(await govToken.allowance(deployer.address, lepidotteri.address)).to.eq(0);
		});

		it('allows for infinite approvals', async () => {
			const amount = 900;
			const maxAmount = ethers.constants.MaxUint256;

			await govToken.approve(lepidotteri.address, maxAmount);

			expect(await govToken.allowance(deployer.address, lepidotteri.address)).to.eq(maxAmount);

			await govToken.connect(lepidotteri).transferFrom(deployer.address, SHA_2048.address, amount);

			expect(await govToken.allowance(deployer.address, lepidotteri.address)).to.eq(maxAmount);
		});

		it('cannot transfer in excess of the spender allowance', async () => {
			await govToken.transfer(lepidotteri.address, 900);

			const balance = await govToken.balanceOf(lepidotteri.address);

			await expect(govToken.transferFrom(lepidotteri.address, SHA_2048.address, balance)).to.revertedWith(
				'revert KING::transferFrom: transfer amount exceeds allowance'
			);
		});
	});

	context('transferWithAuthorization', async () => {
		it('allows a valid transfer with auth', async () => {
			const domainSeparator = getEIP712DomainSeparator(await govToken.name(), govToken.address);
			const value = 90;
			const nonce = ethers.BigNumber.from(ethers.utils.randomBytes(32));
			const validAfter = 0;
			const validBefore = ethers.constants.MaxUint256;
			const digest = getEIP712TransferWithAuthDigest(
				domainSeparator,
				deployer.address,
				lepidotteri.address,
				value,
				validAfter,
				validBefore,
				nonce
			);
			const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(KINGMAKER_DEPLOYER_PK, 'hex'));
			const balanceBefore = await govToken.balanceOf(lepidotteri.address);

			await govToken.transferWithAuthorization(
				deployer.address,
				lepidotteri.address,
				value,
				validAfter,
				validBefore,
				nonce,
				v,
				ethers.utils.hexlify(r),
				ethers.utils.hexlify(s)
			);

			expect(await govToken.balanceOf(lepidotteri.address)).to.eq(balanceBefore.add(value));
		});

		it('does not allow a transfer before auth valid', async () => {
			const domainSeparator = getEIP712DomainSeparator(await govToken.name(), govToken.address);
			const value = 90;
			const nonce = ethers.BigNumber.from(ethers.utils.randomBytes(32));
			const { timestamp } = await ethers.provider.getBlock('latest');
			const validAfter = timestamp + 1000;
			const validBefore = ethers.constants.MaxUint256;
			const digest = getEIP712TransferWithAuthDigest(
				domainSeparator,
				deployer.address,
				lepidotteri.address,
				value,
				validAfter,
				validBefore,
				nonce
			);
			const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(KINGMAKER_DEPLOYER_PK, 'hex'));

			await expect(
				govToken.transferWithAuthorization(
					deployer.address,
					lepidotteri.address,
					value,
					validAfter,
					validBefore,
					nonce,
					v,
					ethers.utils.hexlify(r),
					ethers.utils.hexlify(s)
				)
			).to.revertedWith('revert KING::transferWithAuth: auth not yet valid');
		});

		it('does not allow a transfer after auth expiration', async () => {
			const domainSeparator = getEIP712DomainSeparator(await govToken.name(), govToken.address);
			const value = 90;
			const nonce = ethers.BigNumber.from(ethers.utils.randomBytes(32));
			const validAfter = 0;
			const validBefore = 0;
			const digest = getEIP712TransferWithAuthDigest(
				domainSeparator,
				deployer.address,
				lepidotteri.address,
				value,
				validAfter,
				validBefore,
				nonce
			);
			const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(KINGMAKER_DEPLOYER_PK, 'hex'));

			await expect(
				govToken.transferWithAuthorization(
					deployer.address,
					lepidotteri.address,
					value,
					validAfter,
					validBefore,
					nonce,
					v,
					ethers.utils.hexlify(r),
					ethers.utils.hexlify(s)
				)
			).to.revertedWith('revert KING::transferWithAuth: auth expired');
		});

		it('does not allow a reuse of nonce', async () => {
			const domainSeparator = getEIP712DomainSeparator(await govToken.name(), govToken.address);
			const value = 90;
			const nonce = ethers.BigNumber.from(ethers.utils.randomBytes(32));
			const validAfter = 0;
			const validBefore = ethers.constants.MaxUint256;
			let digest = getEIP712TransferWithAuthDigest(
				domainSeparator,
				deployer.address,
				lepidotteri.address,
				value,
				validAfter,
				validBefore,
				nonce
			);
			const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(KINGMAKER_DEPLOYER_PK, 'hex'));

			const balanceBefore = await govToken.balanceOf(lepidotteri.address);
			await govToken.transferWithAuthorization(
				deployer.address,
				lepidotteri.address,
				value,
				validAfter,
				validBefore,
				nonce,
				v,
				ethers.utils.hexlify(r),
				ethers.utils.hexlify(s)
			);
			expect(await govToken.balanceOf(lepidotteri.address)).to.eq(balanceBefore.add(value));

			digest = getEIP712TransferWithAuthDigest(
				domainSeparator,
				deployer.address,
				SHA_2048.address,
				value,
				validAfter,
				validBefore,
				nonce
			);
			const sig = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(KINGMAKER_DEPLOYER_PK, 'hex'));

			await expect(
				govToken.transferWithAuthorization(
					deployer.address,
					SHA_2048.address,
					value,
					validAfter,
					validBefore,
					nonce,
					sig.v,
					ethers.utils.hexlify(sig.r),
					ethers.utils.hexlify(sig.s)
				)
			).to.revertedWith('revert KING::transferWithAuth: auth already used');
		});
	});

	context('receiveWithAuthorization', async () => {
		it('allows a valid receive with auth', async () => {
			const domainSeparator = getEIP712DomainSeparator(await govToken.name(), govToken.address);
			const value = 90;
			const nonce = ethers.BigNumber.from(ethers.utils.randomBytes(32));
			const validAfter = 0;
			const validBefore = ethers.constants.MaxUint256;
			const digest = getEIP712ReceiveWithAuthDigest(
				domainSeparator,
				deployer.address,
				lepidotteri.address,
				value,
				validAfter,
				validBefore,
				nonce
			);

			const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(KINGMAKER_DEPLOYER_PK, 'hex'));

			const balanceBefore = await govToken.balanceOf(lepidotteri.address);
			await govToken
				.connect(lepidotteri)
				.receiveWithAuthorization(
					deployer.address,
					lepidotteri.address,
					value,
					validAfter,
					validBefore,
					nonce,
					v,
					ethers.utils.hexlify(r),
					ethers.utils.hexlify(s)
				);
			expect(await govToken.balanceOf(lepidotteri.address)).to.eq(balanceBefore.add(value));
		});

		it('does not allow a user to initiate a transfer intended for another user', async () => {
			const domainSeparator = getEIP712DomainSeparator(await govToken.name(), govToken.address);
			const value = 90;
			const nonce = ethers.BigNumber.from(ethers.utils.randomBytes(32));
			const validAfter = 0;
			const validBefore = ethers.constants.MaxUint256;
			const digest = getEIP712ReceiveWithAuthDigest(
				domainSeparator,
				deployer.address,
				lepidotteri.address,
				value,
				validAfter,
				validBefore,
				nonce
			);
			const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(KINGMAKER_DEPLOYER_PK, 'hex'));

			await expect(
				govToken
					.connect(SHA_2048)
					.receiveWithAuthorization(
						deployer.address,
						lepidotteri.address,
						value,
						validAfter,
						validBefore,
						nonce,
						v,
						ethers.utils.hexlify(r),
						ethers.utils.hexlify(s)
					)
			).to.revertedWith('revert KING::receiveWithAuth: caller must be the payee');
		});

		it('does not allow a receive before auth valid', async () => {
			const domainSeparator = getEIP712DomainSeparator(await govToken.name(), govToken.address);
			const value = 90;
			const nonce = ethers.BigNumber.from(ethers.utils.randomBytes(32));
			const { timestamp } = await ethers.provider.getBlock('latest');
			const validAfter = timestamp + 1000;
			const validBefore = ethers.constants.MaxUint256;
			const digest = getEIP712ReceiveWithAuthDigest(
				domainSeparator,
				deployer.address,
				lepidotteri.address,
				value,
				validAfter,
				validBefore,
				nonce
			);
			const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(KINGMAKER_DEPLOYER_PK, 'hex'));

			await expect(
				govToken
					.connect(lepidotteri)
					.receiveWithAuthorization(
						deployer.address,
						lepidotteri.address,
						value,
						validAfter,
						validBefore,
						nonce,
						v,
						ethers.utils.hexlify(r),
						ethers.utils.hexlify(s)
					)
			).to.revertedWith('revert KING::receiveWithAuth: auth not yet valid');
		});

		it('does not allow a receive after auth expiration', async () => {
			const domainSeparator = getEIP712DomainSeparator(await govToken.name(), govToken.address);
			const value = 90;
			const nonce = ethers.BigNumber.from(ethers.utils.randomBytes(32));
			const validAfter = 0;
			const validBefore = 0;
			const digest = getEIP712ReceiveWithAuthDigest(
				domainSeparator,
				deployer.address,
				lepidotteri.address,
				value,
				validAfter,
				validBefore,
				nonce
			);
			const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(KINGMAKER_DEPLOYER_PK, 'hex'));

			await expect(
				govToken
					.connect(lepidotteri)
					.receiveWithAuthorization(
						deployer.address,
						lepidotteri.address,
						value,
						validAfter,
						validBefore,
						nonce,
						v,
						ethers.utils.hexlify(r),
						ethers.utils.hexlify(s)
					)
			).to.revertedWith('revert KING::receiveWithAuth: auth expired');
		});

		it('does not allow a reuse of nonce', async () => {
			const domainSeparator = getEIP712DomainSeparator(await govToken.name(), govToken.address);
			const value = 90;
			const nonce = ethers.BigNumber.from(ethers.utils.randomBytes(32));
			const validAfter = 0;
			const validBefore = ethers.constants.MaxUint256;
			let digest = getEIP712ReceiveWithAuthDigest(
				domainSeparator,
				deployer.address,
				lepidotteri.address,
				value,
				validAfter,
				validBefore,
				nonce
			);
			const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(KINGMAKER_DEPLOYER_PK, 'hex'));

			const balanceBefore = await govToken.balanceOf(lepidotteri.address);
			await govToken
				.connect(lepidotteri)
				.receiveWithAuthorization(
					deployer.address,
					lepidotteri.address,
					value,
					validAfter,
					validBefore,
					nonce,
					v,
					ethers.utils.hexlify(r),
					ethers.utils.hexlify(s)
				);
			expect(await govToken.balanceOf(lepidotteri.address)).to.eq(balanceBefore.add(value));

			digest = getEIP712ReceiveWithAuthDigest(domainSeparator, deployer.address, SHA_2048.address, value, validAfter, validBefore, nonce);
			const sig = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(KINGMAKER_DEPLOYER_PK, 'hex'));

			await expect(
				govToken
					.connect(SHA_2048)
					.receiveWithAuthorization(
						deployer.address,
						SHA_2048.address,
						value,
						validAfter,
						validBefore,
						nonce,
						sig.v,
						ethers.utils.hexlify(sig.r),
						ethers.utils.hexlify(sig.s)
					)
			).to.revertedWith('revert KING::receiveWithAuth: auth already used');
		});
	});

	context('permit', async () => {
		it('allows a valid permit', async () => {
			const domainSeparator = getEIP712DomainSeparator(await govToken.name(), govToken.address);
			const value = 270495;
			const nonce = await govToken.nonces(deployer.address);
			const deadline = ethers.constants.MaxUint256;
			const digest = getEIP712PermitDigest(domainSeparator, deployer.address, lepidotteri.address, value, nonce, deadline);
			const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(KINGMAKER_DEPLOYER_PK, 'hex'));

			await govToken.permit(deployer.address, lepidotteri.address, value, deadline, v, ethers.utils.hexlify(r), ethers.utils.hexlify(s));
			expect(await govToken.allowance(deployer.address, lepidotteri.address)).to.eq(value);
			expect(await govToken.nonces(deployer.address)).to.eq(1);

			await govToken.connect(lepidotteri).transferFrom(deployer.address, SHA_2048.address, value);
		});

		it('does not allow a permit after deadline', async () => {
			const domainSeparator = getEIP712DomainSeparator(await govToken.name(), govToken.address);
			const value = 270495;
			const nonce = await govToken.nonces(deployer.address);
			const deadline = 0;
			const digest = getEIP712PermitDigest(domainSeparator, deployer.address, lepidotteri.address, value, nonce, deadline);
			const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(KINGMAKER_DEPLOYER_PK, 'hex'));

			await expect(
				govToken.permit(deployer.address, lepidotteri.address, value, deadline, v, ethers.utils.hexlify(r), ethers.utils.hexlify(s))
			).to.revertedWith('revert KING::permit: signature expired');
		});
	});

	context('mint', async () => {
		it('can perform a valid mint', async () => {
			const totalSupplyBefore = await govToken.totalSupply();
			const mintCap = await govToken.mintCap();
			const maxAmount = totalSupplyBefore.mul(mintCap).div(1000000);
			const supplyChangeAllowed = await govToken.supplyChangeAllowedAfter();
			await ethers.provider.send('evm_setNextBlockTimestamp', [parseInt(supplyChangeAllowed.toString())]);
			const balanceBefore = await govToken.balanceOf(lepidotteri.address);
			await govToken.mint(lepidotteri.address, maxAmount);
			expect(await govToken.balanceOf(lepidotteri.address)).to.equal(balanceBefore.add(maxAmount));
			expect(await govToken.totalSupply()).to.equal(totalSupplyBefore.add(maxAmount));
		});

		it('only supply manager can mint', async () => {
			await expect(govToken.connect(lepidotteri).mint(SHA_2048.address, 1)).to.revertedWith(
				'revert KING::mint: only the supplyManager can mint'
			);
		});

		it('cannot mint to the zero address', async () => {
			await expect(govToken.mint(O_Address, 1)).to.revertedWith('revert KING::mint: cannot transfer to the zero address');
		});

		it('cannot mint in excess of the mint cap', async () => {
			const totalSupply = await govToken.totalSupply();
			const mintCap = await govToken.mintCap();
			const maxAmount = totalSupply.mul(mintCap).div(1000000);
			await expect(govToken.mint(lepidotteri.address, maxAmount.add(1))).to.revertedWith('revert KING::mint: exceeded mint cap');
		});

		it('cannot mint before supply change allowed', async () => {
			await expect(govToken.mint(lepidotteri.address, 1)).to.revertedWith('revert KING::mint: minting not allowed yet');
		});
	});

	context('burn', async () => {
		it('can perform a valid burn', async () => {
			const amount = 900;
			const totalSupplyBefore = await govToken.totalSupply();
			await govToken.transfer(lepidotteri.address, amount);
			const balanceBefore = await govToken.balanceOf(lepidotteri.address);
			await govToken.connect(lepidotteri).approve(deployer.address, amount);
			const allowanceBefore = await govToken.allowance(lepidotteri.address, deployer.address);
			const supplyChangeAllowed = await govToken.supplyChangeAllowedAfter();
			await ethers.provider.send('evm_setNextBlockTimestamp', [parseInt(supplyChangeAllowed.toString())]);
			await govToken.burn(lepidotteri.address, amount);
			expect(await govToken.balanceOf(lepidotteri.address)).to.equal(balanceBefore.sub(amount));
			expect(await govToken.allowance(lepidotteri.address, deployer.address)).to.equal(allowanceBefore.sub(amount));
			expect(await govToken.totalSupply()).to.equal(totalSupplyBefore.sub(amount));
		});

		it('only supply manager can burn', async () => {
			await expect(govToken.connect(lepidotteri).burn(deployer.address, 1)).to.revertedWith(
				'revert KING::burn: only the supplyManager can burn'
			);
		});

		it('cannot burn from the zero address', async () => {
			await expect(govToken.burn(O_Address, 1)).to.revertedWith('revert KING::burn: cannot transfer from the zero address');
		});

		it('cannot burn before supply change allowed', async () => {
			await expect(govToken.burn(deployer.address, 1)).to.revertedWith('revert KING::burn: burning not allowed yet');
		});

		it('cannot burn in excess of the spender balance', async () => {
			const supplyChangeAllowed = await govToken.supplyChangeAllowedAfter();
			await ethers.provider.send('evm_setNextBlockTimestamp', [parseInt(supplyChangeAllowed.toString())]);
			const balance = await govToken.balanceOf(lepidotteri.address);
			await govToken.connect(lepidotteri).approve(deployer.address, balance);
			await expect(govToken.burn(lepidotteri.address, balance.add(1))).to.revertedWith(
				'revert KING::burn: burn amount exceeds allowance'
			);
		});

		it('cannot burn in excess of the spender allowance', async () => {
			const supplyChangeAllowed = await govToken.supplyChangeAllowedAfter();
			await ethers.provider.send('evm_setNextBlockTimestamp', [parseInt(supplyChangeAllowed.toString())]);
			await govToken.transfer(lepidotteri.address, 900);
			const balance = await govToken.balanceOf(lepidotteri.address);
			await expect(govToken.burn(lepidotteri.address, balance)).to.revertedWith('revert KING::burn: burn amount exceeds allowance');
		});
	});
});
