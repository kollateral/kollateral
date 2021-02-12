import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { BigNumber, Contract } from 'ethers';
import { ethers } from 'hardhat';

import { expect } from 'chai';

describe('TestCollateralizedERC20', () => {
	let accounts: SignerWithAddress[];
	let owner: SignerWithAddress;
	let user: SignerWithAddress;

	let TestCollateralizedERC20: Contract;
	let TestToken: Contract;

	before(async () => {
		accounts = await ethers.getSigners();
		owner = accounts[0];
		user = accounts[1];
	});

	beforeEach(async () => {
		const TestTokenFactory = await ethers.getContractFactory('TestToken');
		TestToken = await TestTokenFactory.deploy('TestToken TT', 'TT');
		await TestToken.deployed();

		const TestCollateralizedERC20Factory = await ethers.getContractFactory('TestCollateralizedERC20');
		TestCollateralizedERC20 = await TestCollateralizedERC20Factory.deploy(TestToken.address, 'Collateralized TT', 'kTT');
		await TestCollateralizedERC20.deployed();

		await TestToken.connect(owner).mint(await owner.getBalance());
		await TestToken.connect(user).mint(await user.getBalance());
	});

	describe('mint', () => {
		const amount = ethers.BigNumber.from(1000);
		const amountAfterPayback = ethers.BigNumber.from(500);

		describe('when supplying more than balance', () => {
			let balance: BigNumber;

			beforeEach('minting', async () => {
				balance = await TestToken.balanceOf(user.address);
			});

			it('reverts', async () => {
				await TestToken.connect(owner).approve(TestCollateralizedERC20.address, balance.add(1));
				await expect(TestCollateralizedERC20.connect(user).mint(balance.add(1))).to.be.revertedWith(
					'ERC20: transfer amount exceeds balance'
				);
			});
		});

		describe('when supplying more than approval', () => {
			let balance: BigNumber;
			beforeEach('minting', async () => {
				balance = await TestToken.balanceOf(user.address);
			});

			it('reverts', async () => {
				await TestToken.connect(owner).approve(TestCollateralizedERC20.address, balance.sub(1));
				await expect(TestCollateralizedERC20.connect(user).mint(balance)).to.be.revertedWith(
					'UnlimitedApprovalERC20: transfer amount exceeds allowance'
				);
			});
		});

		describe('for an empty pool', () => {
			beforeEach('minting', async () => {
				await TestToken.connect(user).approve(TestCollateralizedERC20.address, amount);
				await TestCollateralizedERC20.connect(user).mint(amount);
			});

			it('increments recipient collateralizedErc20 balance', async () => {
				expect(await TestCollateralizedERC20.balanceOf(user.address)).to.be.equal(amount);
			});

			it('increments totalReserve', async () => {
				expect(await TestCollateralizedERC20.totalReserve()).to.be.equal(amount);
			});

			it('emits Mint event', async () => {
				const event = TestCollateralizedERC20.filters.Mint();
				// TODO verify event correctly reports tokenAmount and kTokenAmount
				expect(event).to.be.not.null;
			});
		});

		describe('for a not empty pool', () => {
			beforeEach('minting', async () => {
				await TestToken.connect(user).approve(TestCollateralizedERC20.address, amount);
				await TestCollateralizedERC20.connect(user).mint(amount);
				await TestToken.connect(user).transfer(TestCollateralizedERC20.address, amount);
				await TestToken.connect(user).approve(TestCollateralizedERC20.address, amount);
				await TestCollateralizedERC20.connect(user).mint(amount);
			});

			it('increments recipient collateralizedErc20 balance', async () => {
				expect(await TestCollateralizedERC20.balanceOf(user.address)).to.be.equal(amount.add(amountAfterPayback));
			});

			it('increments totalReserve', async () => {
				expect(await TestCollateralizedERC20.totalReserve()).to.be.equal(amount.mul(3));
			});

			it('emits Mint event', async () => {
				const event = TestCollateralizedERC20.filters.Mint();
				// TODO check ammounts on mint event
				expect(event).to.be.not.null;
			});
		});

		describe('for non-clean rounding', () => {
			const amountAfterPaybackFloor = ethers.BigNumber.from(333);

			beforeEach('minting', async () => {
				await TestToken.connect(user).approve(TestCollateralizedERC20.address, amount);
				await TestCollateralizedERC20.connect(user).mint(amount);
				await TestToken.connect(user).transfer(TestCollateralizedERC20.address, amount.mul(2));
				await TestToken.connect(user).approve(TestCollateralizedERC20.address, amount);
				await TestCollateralizedERC20.connect(user).mint(amount);
			});

			it('increments recipient collateralizedErc20 balance', async () => {
				expect(await TestCollateralizedERC20.balanceOf(user.address)).to.be.equal(amount.add(amountAfterPaybackFloor));
			});

			it('increments totalReserve', async () => {
				expect(await TestCollateralizedERC20.totalReserve()).to.be.equal(amount.mul(4));
			});

			it('emits Mint event', async () => {
				const event = TestCollateralizedERC20.filters.Mint();
				// TODO check ammounts on mint event
				expect(event).to.be.not.null;
			});
		});
	});

	describe('redeem', () => {
		const zero = ethers.BigNumber.from(0);
		const amount = ethers.BigNumber.from(1000);
		const amountAfterPayback = ethers.BigNumber.from(500);

		describe('when redeeming with zero balance', () => {
			let balance: BigNumber;

			beforeEach('redeem', async () => {
				balance = await TestCollateralizedERC20.balanceOf(user.address);
			});

			it('reverts', async () => {
				await expect(TestCollateralizedERC20.connect(user).redeem(balance.add(1))).to.be.revertedWith('CollateralizedToken: no supply');
			});
		});

		describe('when redeeming more than balance', () => {
			let balance: BigNumber;

			beforeEach('redeem', async () => {
				await TestToken.connect(user).approve(TestCollateralizedERC20.address, amount);
				await TestCollateralizedERC20.connect(user).mint(amount);
				balance = await TestCollateralizedERC20.balanceOf(user.address);
			});

			it('reverts', async () => {
				await expect(TestCollateralizedERC20.connect(user).redeem(balance.add(1))).to.be.revertedWith(
					'ERC20: burn amount exceeds balance'
				);
			});
		});

		describe('for a single-mint pool', () => {
			beforeEach('redeeming', async () => {
				await TestToken.connect(user).approve(TestCollateralizedERC20.address, amount);
				await TestCollateralizedERC20.connect(user).mint(amount);
				await TestCollateralizedERC20.connect(user).redeem(amount);
			});

			it('decrements recipient collateralizedErc20 balance', async () => {
				expect(await TestCollateralizedERC20.balanceOf(user.address)).to.be.equal(zero);
			});

			it('decrements totalReserve', async () => {
				expect(await TestCollateralizedERC20.totalReserve()).to.be.equal(zero);
			});

			it('emits Redeem event', async () => {
				const event = TestCollateralizedERC20.filters.Redeem();
				// TODO check ammounts on mint event
				expect(event).to.be.not.null;
			});
		});

		describe('for a multi-mint pool', () => {
			beforeEach('redeeming', async () => {
				await TestToken.connect(user).approve(TestCollateralizedERC20.address, amount);
				await TestCollateralizedERC20.connect(user).mint(amount);
				await TestToken.connect(user).transfer(TestCollateralizedERC20.address, amount);
				await TestToken.connect(user).approve(TestCollateralizedERC20.address, amount);
				await TestCollateralizedERC20.connect(user).mint(amount);
				await TestCollateralizedERC20.connect(user).redeem(amountAfterPayback);
			});

			it('decrements recipient collateralizedErc20 balance', async () => {
				expect(await TestCollateralizedERC20.balanceOf(user.address)).to.be.equal(amount);
			});

			it('decrements totalReserve', async () => {
				expect(await TestCollateralizedERC20.totalReserve()).to.be.equal(amount.mul(2));
			});

			it('emits Redeem event', async () => {
				const event = TestCollateralizedERC20.filters.Redeem();
				// TODO check ammounts on mint event
				expect(event).to.be.not.null;
			});
		});

		describe('for emptying multi-mint pool', () => {
			beforeEach('redeeming', async () => {
				await TestToken.connect(user).approve(TestCollateralizedERC20.address, amount);
				await TestCollateralizedERC20.connect(user).mint(amount);
				await TestToken.connect(user).transfer(TestCollateralizedERC20.address, amount);
				await TestToken.connect(user).approve(TestCollateralizedERC20.address, amount);
				await TestCollateralizedERC20.connect(user).mint(amount);
				await TestCollateralizedERC20.connect(user).redeem(amountAfterPayback);
				await TestCollateralizedERC20.connect(user).redeem(amount);
			});

			it('decrements recipient collateralizedErc20 balance', async () => {
				expect(await TestCollateralizedERC20.balanceOf(user.address)).to.be.equal(zero);
			});

			it('decrements totalReserve', async () => {
				expect(await TestCollateralizedERC20.totalReserve()).to.be.equal(zero);
			});

			it('emits Redeem event', async () => {
				const event = TestCollateralizedERC20.filters.Redeem();
				// TODO check ammounts on mint event
				expect(event).to.be.not.null;
			});
		});

		describe('for emptying multi-mint non-clean rounding pool', () => {
			beforeEach('redeeming', async () => {
				await TestToken.connect(user).approve(TestCollateralizedERC20.address, amount);
				await TestCollateralizedERC20.connect(user).mint(amount);
				await TestToken.connect(user).transfer(TestCollateralizedERC20.address, amount.div(2));
				await TestToken.connect(user).approve(TestCollateralizedERC20.address, amount);
				await TestCollateralizedERC20.connect(user).mint(amount);
				await TestCollateralizedERC20.connect(user).redeem(amount);
				await TestCollateralizedERC20.connect(user).redeem(ethers.BigNumber.from(666));
			});

			it('decrements recipient collateralizedErc20 balance', async () => {
				expect(await TestCollateralizedERC20.balanceOf(user.address)).to.be.equal(zero);
			});

			it('decrements totalReserve', async () => {
				expect(await TestCollateralizedERC20.totalReserve()).to.be.equal(zero);
			});

			it('emits both Redeem events', async () => {
				const event = TestCollateralizedERC20.filters.Redeem();
				// TODO check ammounts on mint event
				expect(event).to.be.not.null;
			});
		});
	});

	describe('redeemUnderlying', () => {
		const zero = ethers.BigNumber.from(0);
		const amount = ethers.BigNumber.from(1000);
		const amountAfterPayback = ethers.BigNumber.from(500);

		describe('when redeeming with zero balance', () => {
			let balance: BigNumber;

			beforeEach('redeem', async () => {
				balance = await TestCollateralizedERC20.balanceOfUnderlying(user.address);
			});

			it('reverts', async () => {
				await expect(TestCollateralizedERC20.connect(user).redeemUnderlying(balance.add(1))).to.be.revertedWith(
					'CollateralizedToken: no reserve'
				);
			});
		});

		describe('when redeeming more than balance', () => {
			let balance: BigNumber;

			beforeEach('redeem', async () => {
				await TestToken.connect(user).approve(TestCollateralizedERC20.address, amount);
				await TestCollateralizedERC20.connect(user).mint(amount);
				balance = await TestCollateralizedERC20.balanceOf(user.address);
			});

			it('reverts', async () => {
				await expect(TestCollateralizedERC20.redeemUnderlying(balance.add(1))).to.be.revertedWith('ERC20: burn amount exceeds balance');
			});
		});

		describe('for a single-mint pool', () => {
			beforeEach('redeeming', async () => {
				await TestToken.connect(user).approve(TestCollateralizedERC20.address, amount);
				await TestCollateralizedERC20.connect(user).mint(amount);
				await TestCollateralizedERC20.connect(user).redeemUnderlying(amount);
			});

			it('decrements recipient collateralizedErc20 balance', async () => {
				expect(await TestCollateralizedERC20.balanceOf(user.address)).to.be.equal(zero);
			});

			it('decrements totalReserve', async () => {
				expect(await TestCollateralizedERC20.totalReserve()).to.be.equal(zero);
			});

			it('emits Redeem event', async () => {
				const event = TestCollateralizedERC20.filters.Redeem();
				// TODO check ammounts on mint event
				expect(event).to.be.not.null;
			});
		});

		describe('for a multi-mint pool', () => {
			beforeEach('redeeming', async () => {
				await TestToken.connect(user).approve(TestCollateralizedERC20.address, amount);
				await TestCollateralizedERC20.connect(user).mint(amount);
				await TestToken.connect(user).transfer(TestCollateralizedERC20.address, amount);
				await TestToken.connect(user).approve(TestCollateralizedERC20.address, amount);
				await TestCollateralizedERC20.connect(user).mint(amount);
				await TestCollateralizedERC20.connect(user).redeemUnderlying(amount);
			});

			it('decrements recipient collateralizedErc20 balance', async () => {
				expect(await TestCollateralizedERC20.balanceOf(user.address)).to.be.equal(amount);
			});

			it('decrements totalReserve', async () => {
				expect(await TestCollateralizedERC20.totalReserve()).to.be.equal(amount.mul(2));
			});

			it('emits Redeem event', async () => {
				const event = TestCollateralizedERC20.filters.Redeem();
				// TODO check ammounts on mint event
				expect(event).to.be.not.null;
			});
		});

		describe('for emptying multi-mint pool', () => {
			beforeEach('redeeming', async () => {
				await TestToken.connect(user).approve(TestCollateralizedERC20.address, amount);
				await TestCollateralizedERC20.connect(user).mint(amount);
				await TestToken.connect(user).transfer(TestCollateralizedERC20.address, amount);
				await TestToken.connect(user).approve(TestCollateralizedERC20.address, amount);
				await TestCollateralizedERC20.connect(user).mint(amount);
				await TestCollateralizedERC20.connect(user).redeemUnderlying(amount);
				await TestCollateralizedERC20.connect(user).redeemUnderlying(amount.mul(2));
			});

			it('decrements recipient collateralizedErc20 balance', async () => {
				expect(await TestCollateralizedERC20.balanceOf(user.address)).to.be.equal(zero);
			});

			it('decrements totalReserve', async () => {
				expect(await TestCollateralizedERC20.totalReserve()).to.be.equal(zero);
			});

			it('emits Redeem event', async () => {
				const event = TestCollateralizedERC20.filters.Redeem();
				// TODO check ammounts on mint event
				expect(event).to.be.not.null;
			});
		});

		describe('for emptying multi-mint non-clean rounding pool', () => {
			beforeEach('redeeming', async () => {
				await TestToken.connect(user).approve(TestCollateralizedERC20.address, amount);
				await TestCollateralizedERC20.connect(user).mint(amount);
				await TestToken.connect(user).transfer(TestCollateralizedERC20.address, amount.div(2));
				await TestToken.connect(user).approve(TestCollateralizedERC20.address, amount);
				await TestCollateralizedERC20.connect(user).mint(amount, { from: user.address });
				await TestCollateralizedERC20.connect(user).redeemUnderlying(ethers.BigNumber.from(1500));
				await TestCollateralizedERC20.connect(user).redeemUnderlying(amount);
			});

			it('decrements recipient collateralizedErc20 balance', async () => {
				expect(await TestCollateralizedERC20.balanceOf(user.address)).to.be.equal(zero);
			});

			it('decrements totalReserve', async () => {
				expect(await TestCollateralizedERC20.totalReserve()).to.be.equal(zero);
			});

			it('emits both Redeem events', async () => {
				const event = TestCollateralizedERC20.filters.Redeem();
				// TODO check ammounts on mint event
				expect(event).to.be.not.null;
			});
		});
	});

	describe('underlying', () => {
		describe('when calling underlying', () => {
			it('returns underlying token', async () => {
				expect(await TestCollateralizedERC20.underlying()).to.be.equal(TestToken.address);
			});
		});
	});

	describe('isUnderlyingEther', () => {
		describe('when calling isUnderlyingEther', () => {
			it('returns false', async () => {
				expect(await TestCollateralizedERC20.isUnderlyingEther()).to.be.equal(false);
			});
		});
	});
});
