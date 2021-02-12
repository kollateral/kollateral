import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { ParamType } from 'ethers/lib/utils';
import { BigNumber, Contract } from 'ethers';
import { ethers } from 'hardhat';

import { expect } from 'chai';

function encodeExecute(type: any, abi: (string | ParamType)[], data: any[]) {
	const encodedData = ethers.utils.defaultAbiCoder.encode(abi, data);
	return ethers.utils.defaultAbiCoder.encode(['uint256', 'bytes'], [type, encodedData]);
}

describe('KERC20', () => {
	const erc20Balance = ethers.BigNumber.from(10).pow(20); // 100 TT
	const noopInvokerBalance = ethers.BigNumber.from(10000);
	const kErc20UnderlyingBalance = ethers.BigNumber.from(100000);
	const platformRewardBips = ethers.BigNumber.from(5);
	const poolRewardBips = ethers.BigNumber.from(20);
	const kErc20UnderlyingBalanceWithReward = ethers.BigNumber.from(100200);

	let owner: SignerWithAddress;
	let user: SignerWithAddress;
	let vault: SignerWithAddress;
	before(async () => {
		const [addr1, addr2, addr3] = await ethers.getSigners();
		owner = addr1;
		user = addr2;
		vault = addr3;
	});

	let KERC20: Contract;
	let TestInvokable: Contract;
	let TestToken: Contract;

	beforeEach(async () => {
		const TestInvokableFactory = await ethers.getContractFactory('TestInvokable');
		TestInvokable = await TestInvokableFactory.connect(owner).deploy();
		await TestInvokable.deployed();

		const TestTokenFactory = await ethers.getContractFactory('TestToken');
		TestToken = await TestTokenFactory.connect(owner).deploy('Test Token', 'TT');
		await TestToken.deployed();

		const KERC20Factory = await ethers.getContractFactory('KERC20');
		KERC20 = await KERC20Factory.connect(owner).deploy(TestToken.address, 'kingMaker TT', 'kTT');
		await KERC20.deployed();

		await KERC20.connect(owner).setPlatformReward(platformRewardBips);
		await KERC20.connect(owner).setPoolReward(poolRewardBips);
		await KERC20.connect(owner).setPlatformVaultAddress(vault.address);

		await TestToken.mint(noopInvokerBalance.toString());
		await TestToken.transfer(TestInvokable.address, noopInvokerBalance.toString());

		await TestToken.mint(kErc20UnderlyingBalance.toString());
		await TestToken.approve(KERC20.address, kErc20UnderlyingBalance.toString());
		await KERC20.mint(kErc20UnderlyingBalance.toString());

		await TestToken.mint(erc20Balance.toString());
	});

	describe('invoke', () => {
		let vaultStartingBalance: BigNumber;
		let underlying;
		describe('when borrow whole fund with successful repay', () => {
			beforeEach('invoking', async () => {
				vaultStartingBalance = await TestToken.balanceOf(vault.address);
				const invokeTo = TestInvokable.address;
				const receipt = await KERC20.invoke(invokeTo, [], kErc20UnderlyingBalance);
				// this.logs = receipt.logs;
				// this.txHash = receipt.tx;
				underlying = await KERC20.underlying();
			});

			it('increments totalReserve', async () => {
				expect(await KERC20.totalReserve()).to.be.equal(kErc20UnderlyingBalanceWithReward);
			});

			it('emits Reward event', async () => {
				const event = KERC20.filters.Reward();
				// TODO properly test event content
				expect(event).to.be.not.null;
			});

			it('emits Invocation event', async () => {
				const event = KERC20.filters.Invocation();
				// TODO properly test event content
				expect(event).to.be.not.null;
			});

			it('emits HelperDump event', async () => {
				const event = TestInvokable.filters.HelperDump();
				// TODO properly test event content
				expect(event).to.be.not.null;
			});

			it('increments vault balance', async () => {
				expect(await TestToken.balanceOf(vault.address)).to.be.equal(vaultStartingBalance.add(50));
			});
		});

		describe('when forwarding value to payable invocation', () => {
			const testPayableAmount = ethers.BigNumber.from(15);

			beforeEach('invoking', async () => {
				vaultStartingBalance = await TestToken.balanceOf(vault.address);
				const invokeData = encodeExecute(4, ['uint256'], [testPayableAmount.toString()]);
				const invokeTo = TestInvokable.address;
				const receipt = await KERC20.invoke(invokeTo, invokeData, kErc20UnderlyingBalance, { value: testPayableAmount });
				// this.logs = receipt.logs;
				// this.txHash = receipt.tx;
				underlying = await KERC20.underlying();
			});

			it('increments totalReserve', async () => {
				expect(await KERC20.totalReserve()).to.be.equal(kErc20UnderlyingBalanceWithReward);
			});

			it('emits Reward event', async () => {
				const event = KERC20.filters.Reward();
				// TODO properly test event content
				expect(event).to.be.not.null;
			});

			it('emits Invocation event', async () => {
				const event = KERC20.filters.Invocation();
				// TODO properly test event content
				expect(event).to.be.not.null;
			});

			it('emits HelperDump event', async () => {
				const event = TestInvokable.filters.HelperDump();
				// TODO properly test event content
				expect(event).to.be.not.null;
			});

			it('increments vault balance', async () => {
				expect(await TestToken.balanceOf(vault.address)).to.be.equal(vaultStartingBalance.add(50));
			});
		});

		describe('when borrow whole fund with too high repay', () => {
			const tooMuch = kErc20UnderlyingBalanceWithReward.add(1).toString();

			it('reverts', async () => {
				const invokeData = encodeExecute(1, ['uint256'], [tooMuch.toString()]);
				const invokeTo = TestInvokable.address;
				await expect(KERC20.invoke(invokeTo, invokeData, kErc20UnderlyingBalance)).to.be.revertedWith(
					'KToken: incorrect ending balance'
				);
			});
		});

		describe('when borrow whole fund with too low repay', () => {
			const tooLittle = kErc20UnderlyingBalanceWithReward.sub(1).toString();

			it('reverts', async () => {
				const invokeData = encodeExecute(1, ['uint256'], [tooLittle.toString()]);
				const invokeTo = TestInvokable.address;
				await expect(KERC20.invoke(invokeTo, invokeData, kErc20UnderlyingBalance)).to.be.revertedWith(
					'KToken: incorrect ending balance'
				);
			});
		});

		/*
		 * ADMIN TESTS
		 */

		describe('when setPlatformReward but not admin', () => {
			it('reverts', async () => {
				await expect(KERC20.connect(user).setPlatformReward(platformRewardBips)).to.be.revertedWith('Ownable: caller is not the owner');
			});
		});

		describe('when setPoolReward but not admin', () => {
			it('reverts', async () => {
				await expect(KERC20.connect(user).setPoolReward(poolRewardBips)).to.be.revertedWith('Ownable: caller is not the owner');
			});
		});

		describe('when setPlatformVaultAddress but not admin', () => {
			it('reverts', async () => {
				await expect(KERC20.connect(user).setPlatformVaultAddress(vault.address)).to.be.revertedWith(
					'Ownable: caller is not the owner'
				);
			});
		});

		describe('when paused invoking is disabled', () => {
			beforeEach('invoking', async () => {
				await KERC20.connect(owner).pause();
			});

			it('reverts', async () => {
				const invokeTo = TestInvokable.address;
				// TODO: wrong syntax indeed
				// const invokeData = await TestInvokable.functions.execute("0x").encodeABI();
				// await expect(KERC20.invoke(invokeTo, invokeData, kErc20UnderlyingBalance))
				//    .to.be.revertedWith("Pausable: paused");
			});
		});

		/*
		 *  RECURSIVE CALL TESTS
		 describe('when KERC20 invokes KERC20', () => {
			 it('reverts', async () => {
				 const invokeData = await KERC20.contract.methods
					 .invoke(TestInvokable.address, "0x", kErc20UnderlyingBalance.toNumber().toString(10))
					 .encodeABI();

				 await expect(KERC20.invoke(KERC20.address, invokeData, kErc20UnderlyingBalance))
					 .to.be.revertedWith("KToken: cannot invoke this contract");
			 });
		 });

		 describe('when invokable invokes KERC20.invoke()', () => {
			 it('reverts', async () => {
				 // (A) Invoker: invoke -> invokable fallback(), send whole KERC20 pool
				 const invokableRunInvokeData = await KERC20.contract.methods
					 .invoke(TestInvokable.address, "0x", kErc20UnderlyingBalance.toNumber().toString(10))
					 .encodeABI();

				 // (B) Invokable: invoke -> (A)
				 const invokeData = encodeExecute(3, ["address", "bytes"], [KERC20.address, invokableRunInvokeData]);

				 // (C) Invoker: invoke -> (B), send whole KERC20 pool
				 const invoke = KERC20.invoke(TestInvokable.address, invokeData, kErc20UnderlyingBalance);

				 await expect(invoke).to.be.revertedWith("ReentrancyGuard: reentrant call");
			 });
		 });

		 describe('when invokable invokes KERC20.mint()', () => {
			 beforeEach('invoking', async () => {
				 const invokeTo = TestToken.address;
				 const invokeData = TestToken.contract.methods.approve(KERC20.address, ethers.BigNumber.from(1).toString()).encodeABI();
				 await TestInvokable.invoke(invokeTo, invokeData);
			 });

			 it('reverts', async () => {
				 // (A) KERC20: mint
				 const invokableRunInvokeAddress = KERC20.address;
				 const invokableRunInvokeData =
					 await KERC20.contract.methods
					 .mint(1)
					 .encodeABI();

				 // (B) Invokable: invoke -> (A)
				 const invokeTo = TestInvokable.address;
				 const invokeData = encodeExecute(3, ["address", "bytes"], [invokableRunInvokeAddress, invokableRunInvokeData]);

				 // (C) Invoker: invoke -> (B), send whole KERC20 pool
				 const invoke = KERC20.invoke(invokeTo, invokeData, kErc20UnderlyingBalance);

				 await expect(invoke).to.be.revertedWith("ReentrancyGuard: reentrant call");
			 });
		 });

		 describe('when invokable invokes KERC20.redeem()', () => {
			 beforeEach('invoking', async () => {
				 let invokeTo = TestToken.address;
				 let invokeData = TestToken.contract.methods.approve(KERC20.address, ethers.BigNumber.from(1000).toString()).encodeABI();
				 await TestInvokable.invoke(invokeTo, invokeData);

				 invokeTo = KERC20.address;
				 invokeData = KERC20.contract.methods.mint(ethers.BigNumber.from(1000).toString()).encodeABI();
				 await TestInvokable.invoke(invokeTo, invokeData);
			 });

			 it('reverts', async () => {
				 // (A) KEther: mint
				 const invokableRunInvokeAddress = KERC20.address;
				 const invokableRunInvokeData = await KERC20.contract.methods
					 .redeem(1000)
					 .encodeABI();

				 // (B) Invokable: invoke -> (A)
				 const invokeTo = TestInvokable.address;
				 const invokeData = encodeExecute(3, ["address", "bytes"], [invokableRunInvokeAddress, invokableRunInvokeData]);

				 // (C) Invoker: invoke -> (B), send whole KERC20 pool
				 const invoke = KERC20.invoke(invokeTo, invokeData, kErc20UnderlyingBalance);

				 await expect(invoke).to.be.revertedWith("ReentrancyGuard: reentrant call");
			 });
		 });

		 describe('when invokable invokes KERC20.redeemUnderlying()', () => {
			 beforeEach('invoking', async () => {
				 let invokeTo = TestToken.address;
				 let invokeData = TestToken.contract.methods.approve(KERC20.address, ethers.BigNumber.from(1000).toString()).encodeABI();
				 await TestInvokable.invoke(invokeTo, invokeData);

				 invokeTo = KERC20.address;
				 invokeData = KERC20.contract.methods.mint(ethers.BigNumber.from(1000).toString()).encodeABI();
				 await TestInvokable.invoke(invokeTo, invokeData);
			 });

			 it('reverts', async () => {
				 // (A) KEther: redeemUnderlying
				 const b = (await KERC20.balanceOfUnderlying(TestInvokable.address)).toString();
				 const invokableRunInvokeAddress = KERC20.address;
				 const invokableRunInvokeData = await KERC20.contract.methods
					 .redeemUnderlying(1)
					 .encodeABI();

				 // (B) Invokable: invoke -> (A)
				 const invokeTo = TestInvokable.address;
				 const invokeData = encodeExecute(3, ["address", "bytes"], [invokableRunInvokeAddress, invokableRunInvokeData]);

				 // (C) Invoker: invoke -> (B), send whole KERC20 pool
				 const invoke = KERC20.invoke(invokeTo, invokeData, kErc20UnderlyingBalance);

				 await expect(invoke).to.be.revertedWith("ReentrancyGuard: reentrant call");
			 });
		 });
		 */
	});
});
