import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";

import { expect } from "chai";


describe('TestCollateralizedErc20', function () {
  let accounts: SignerWithAddress[];
  let owner: SignerWithAddress;
  let user: SignerWithAddress;

  let TestCollateralizedErc20: Contract;
  let TestToken: Contract; 

  before(async () => {
      accounts = await ethers.getSigners();
      owner = accounts[0];
      user = accounts[1];
  });

  beforeEach(async function () {
    const TestTokenFactory = await ethers.getContractFactory("TestToken");
    TestToken = await TestTokenFactory.deploy("TestToken TT", "TT");
    await TestToken.deployed();

    const TestCollateralizedErc20Factory = await ethers.getContractFactory("TestCollateralizedERC20");
    TestCollateralizedErc20 = await TestCollateralizedErc20Factory.deploy(TestToken.address, "Collateraize TT", "colTT");
    await TestCollateralizedErc20.deployed();

    await TestToken.connect(owner).mint(await owner.getBalance());
    await TestToken.connect(user).mint(await user.getBalance());

  });

  describe('mint', function () {

    const amount = ethers.BigNumber.from(1000);
    const amountAfterPayback = ethers.BigNumber.from(500);

    describe('when supplying more than balance', function () {
      let balance: BigNumber;

      beforeEach('minting', async function () {
        balance = await TestToken.balanceOf(user.address);
      });

      it('reverts', async function () {
          await expect(TestCollateralizedErc20.connect(user).mint(balance.add(1)))
          .to.be
          .revertedWith("VM Exception while processing transaction: revert ERC20: transfer amount exceeds balance");
      });
    });


    describe('when supplying more than approval', function () {
      let balance: BigNumber;

      beforeEach('minting', async function () {
        balance = await TestToken.balanceOf(user.address);
      });

      it('reverts', async function () {
        await TestToken.connect(owner).approve(TestCollateralizedErc20.address, balance.sub(1));
        await expect(TestCollateralizedErc20.connect(user).mint(balance))
        .to.be
        .revertedWith("UnlimitedApprovalDetailedErc20: transfer amount exceeds allowance");
      });
    });

    describe('for an empty pool', function () {

      beforeEach('minting', async function () {
        await TestToken.connect(user).approve(TestCollateralizedErc20.address, amount);
        await TestCollateralizedErc20.connect(user).mint(amount);
      });

      it('increments recipient collateralizedErc20 balance', async function () {
        expect(await TestCollateralizedErc20.balanceOf(user.address)).to.be.equal(amount);
      });

      it('increments totalReserve', async function () {
        expect(await TestCollateralizedErc20.totalReserve()).to.be.equal(amount);
      });

      it('emits Mint event', async function () {
        const event = TestCollateralizedErc20.filters.Mint();
        // TODO verify event correctly reports tokenAmount and kTokenAmount
        expect(event).to.be.not.null;
      });
    });    


    describe('for a not empty pool', function () {

      beforeEach('minting', async function () {
        await TestToken.connect(user).approve(TestCollateralizedErc20.address, amount);
        await TestCollateralizedErc20.connect(user).mint(amount);
        await TestToken.connect(user).transfer(TestCollateralizedErc20.address, amount);
        await TestToken.connect(user).approve(TestCollateralizedErc20.address, amount);
        await TestCollateralizedErc20.connect(user).mint(amount);
      });

      it('increments recipient collateralizedErc20 balance', async function () {
        expect(await TestCollateralizedErc20.balanceOf(user.address)).to.be.equal(amount.add(amountAfterPayback));
      });

      it('increments totalReserve', async function () {
        expect(await TestCollateralizedErc20.totalReserve()).to.be.equal(amount.mul(3));
      });

      it('emits Mint event', async function () {
        const event = TestCollateralizedErc20.filters.Mint();
        // TODO check ammounts on mint event
        expect(event).to.be.not.null;
      });
    });

    describe('for non-clean rounding', function () {
      const amountAfterPaybackFloor = ethers.BigNumber.from(333);

      beforeEach('minting', async function () {
        await TestToken.connect(user).approve(TestCollateralizedErc20.address, amount);
        await TestCollateralizedErc20.connect(user).mint(amount);
        await TestToken.connect(user).transfer(TestCollateralizedErc20.address, amount.mul(2));
        await TestToken.connect(user).approve(TestCollateralizedErc20.address, amount);
        await TestCollateralizedErc20.connect(user).mint(amount);
      });

      it('increments recipient collateralizedErc20 balance', async function () {
        expect(await TestCollateralizedErc20.balanceOf(user.address)).to.be.equal(amount.add(amountAfterPaybackFloor));
      });

      it('increments totalReserve', async function () {
        expect(await TestCollateralizedErc20.totalReserve()).to.be.equal(amount.mul(4));
      });

      it('emits Mint event', async function () {
        const event = TestCollateralizedErc20.filters.Mint();
        // TODO check ammounts on mint event
        expect(event).to.be.not.null;
      });
    });
  });



  describe('redeem', function () {
    const zero = ethers.BigNumber.from(0);
    const amount = ethers.BigNumber.from(1000);
    const amountAfterPayback = ethers.BigNumber.from(500);

    describe('when redeeming with zero balance', function () {
      let balance: BigNumber;

      beforeEach('redeem', async function () {
        balance = await TestCollateralizedErc20.balanceOf(user.address);
      });

      it('reverts', async function () {
        await expect(TestCollateralizedErc20.connect(user).redeem(balance.add(1)))
              .to.be
              .revertedWith('CollateralizedToken: no supply');
      });
    });

    describe('when redeeming more than balance', function () {
      let balance: BigNumber;

      beforeEach('redeem', async function () {
        await TestToken.connect(user).approve(TestCollateralizedErc20.address, amount);
        await TestCollateralizedErc20.connect(user).mint(amount);
        balance = await TestCollateralizedErc20.balanceOf(user.address);
      });

      it('reverts', async function () {
        await expect(TestCollateralizedErc20.connect(user).redeem(balance.add(1)))
                  .to.be
                  .revertedWith('ERC20: burn amount exceeds balance');
      });
    });

    describe('for a single-mint pool', function () {
      beforeEach('redeeming', async function () {
        await TestToken.connect(user).approve(TestCollateralizedErc20.address, amount);
        await TestCollateralizedErc20.connect(user).mint(amount);
        await TestCollateralizedErc20.connect(user).redeem(amount);
      });

      it('decrements recipient collateralizedErc20 balance', async function () {
        expect(await TestCollateralizedErc20.balanceOf(user.address)).to.be.equal(zero);
      });

      it('decrements totalReserve', async function () {
        expect(await TestCollateralizedErc20.totalReserve()).to.be.equal(zero);
      });

      it('emits Redeem event', async function () {
        const event = TestCollateralizedErc20.filters.Redeem();
        // TODO check ammounts on mint event
        expect(event).to.be.not.null;
      });
    });

    describe('for a multi-mint pool', function () {
      beforeEach('redeeming', async function () {
        await TestToken.connect(user).approve(TestCollateralizedErc20.address, amount);
        await TestCollateralizedErc20.connect(user).mint(amount);
        await TestToken.connect(user).transfer(TestCollateralizedErc20.address, amount);
        await TestToken.connect(user).approve(TestCollateralizedErc20.address, amount);
        await TestCollateralizedErc20.connect(user).mint(amount);
        await TestCollateralizedErc20.connect(user).redeem(amountAfterPayback);
      });

      it('decrements recipient collateralizedErc20 balance', async function () {
        expect(await TestCollateralizedErc20.balanceOf(user.address)).to.be.equal(amount);
      });

      it('decrements totalReserve', async function () {
        expect(await TestCollateralizedErc20.totalReserve()).to.be.equal(amount.mul(2));
      });

      it('emits Redeem event', async function () {
        const event = TestCollateralizedErc20.filters.Redeem();
        // TODO check ammounts on mint event
        expect(event).to.be.not.null;
      });
    });

    describe('for emptying multi-mint pool', function () {
      beforeEach('redeeming', async function () {
        await TestToken.connect(user).approve(TestCollateralizedErc20.address, amount);
        await TestCollateralizedErc20.connect(user).mint(amount);
        await TestToken.connect(user).transfer(TestCollateralizedErc20.address, amount);
        await TestToken.connect(user).approve(TestCollateralizedErc20.address, amount);
        await TestCollateralizedErc20.connect(user).mint(amount);
        await TestCollateralizedErc20.connect(user).redeem(amountAfterPayback);
        await TestCollateralizedErc20.connect(user).redeem(amount);
      });

      it('decrements recipient collateralizedErc20 balance', async function () {
        expect(await TestCollateralizedErc20.balanceOf(user.address)).to.be.equal(zero);
      });

      it('decrements totalReserve', async function () {
        expect(await TestCollateralizedErc20.totalReserve()).to.be.equal(zero);
      });

      it('emits Redeem event', async function () {
        const event = TestCollateralizedErc20.filters.Redeem();
        // TODO check ammounts on mint event
        expect(event).to.be.not.null;
      });
    });

    describe('for emptying multi-mint non-clean rounding pool', function () {
      beforeEach('redeeming', async function () {
        await TestToken.connect(user).approve(TestCollateralizedErc20.address, amount);
        await TestCollateralizedErc20.connect(user).mint(amount);
        await TestToken.connect(user).transfer(TestCollateralizedErc20.address, amount.div(2));
        await TestToken.connect(user).approve(TestCollateralizedErc20.address, amount);
        await TestCollateralizedErc20.connect(user).mint(amount);
        await TestCollateralizedErc20.connect(user).redeem(amount);
        await TestCollateralizedErc20.connect(user).redeem(ethers.BigNumber.from(666));
      });

      it('decrements recipient collateralizedErc20 balance', async function () {
        expect(await TestCollateralizedErc20.balanceOf(user.address)).to.be.equal(zero);
      });

      it('decrements totalReserve', async function () {
        expect(await TestCollateralizedErc20.totalReserve()).to.be.equal(zero);
      });

      it('emits both Redeem events', async function () {
        const event = TestCollateralizedErc20.filters.Redeem();
        // TODO check ammounts on mint event
        expect(event).to.be.not.null;
      });
    });
  });


  describe('redeemUnderlying', function () {
    const zero = ethers.BigNumber.from(0);
    const amount = ethers.BigNumber.from(1000);
    const amountAfterPayback = ethers.BigNumber.from(500);

    describe('when redeeming with zero balance', function () {
      let balance: BigNumber;

      beforeEach('redeem', async function () {
        balance = await TestCollateralizedErc20.balanceOfUnderlying(user.address);
      });

      it('reverts', async function () {

        await expect(TestCollateralizedErc20.connect(user).redeemUnderlying(balance.add(1)))
              .to.be
              .revertedWith('CollateralizedToken: no reserve');
      });
    });

    describe('when redeeming more than balance', function () {
      let balance: BigNumber;

      beforeEach('redeem', async function () {
        await TestToken.connect(user).approve(TestCollateralizedErc20.address, amount);
        await TestCollateralizedErc20.connect(user).mint(amount);
        balance = await TestCollateralizedErc20.balanceOf(user.address);
      });

      it('reverts', async function () {
        await expect(TestCollateralizedErc20.redeemUnderlying(balance.add(1)))
              .to.be
              .revertedWith('ERC20: burn amount exceeds balance');
      });
    });

    describe('for a single-mint pool', function () {
      beforeEach('redeeming', async function () {
        await TestToken.connect(user).approve(TestCollateralizedErc20.address, amount);
        await TestCollateralizedErc20.connect(user).mint(amount);
        await TestCollateralizedErc20.connect(user).redeemUnderlying(amount);
      });

      it('decrements recipient collateralizedErc20 balance', async function () {
        expect(await TestCollateralizedErc20.balanceOf(user.address)).to.be.equal(zero);
      });

      it('decrements totalReserve', async function () {
        expect(await TestCollateralizedErc20.totalReserve()).to.be.equal(zero);
      });

      it('emits Redeem event', async function () {
        const event = TestCollateralizedErc20.filters.Redeem();
        // TODO check ammounts on mint event
        expect(event).to.be.not.null;
      });
    });

    describe('for a multi-mint pool', function () {
      beforeEach('redeeming', async function () {
        await TestToken.connect(user).approve(TestCollateralizedErc20.address, amount);
        await TestCollateralizedErc20.connect(user).mint(amount);
        await TestToken.connect(user).transfer(TestCollateralizedErc20.address, amount);
        await TestToken.connect(user).approve(TestCollateralizedErc20.address, amount);
        await TestCollateralizedErc20.connect(user).mint(amount);
        await TestCollateralizedErc20.connect(user).redeemUnderlying(amount);
      });

      it('decrements recipient collateralizedErc20 balance', async function () {
        expect(await TestCollateralizedErc20.balanceOf(user.address)).to.be.equal(amount);
      });

      it('decrements totalReserve', async function () {
        expect(await TestCollateralizedErc20.totalReserve()).to.be.equal(amount.mul(2));
      });

      it('emits Redeem event', async function () {
        const event = TestCollateralizedErc20.filters.Redeem();
        // TODO check ammounts on mint event
        expect(event).to.be.not.null;
      });
    });

    describe('for emptying multi-mint pool', function () {
      beforeEach('redeeming', async function () {
        await TestToken.connect(user).approve(TestCollateralizedErc20.address, amount);
        await TestCollateralizedErc20.connect(user).mint(amount);
        await TestToken.connect(user).transfer(TestCollateralizedErc20.address, amount);
        await TestToken.connect(user).approve(TestCollateralizedErc20.address, amount);
        await TestCollateralizedErc20.connect(user).mint(amount);
        await TestCollateralizedErc20.connect(user).redeemUnderlying(amount);
        await TestCollateralizedErc20.connect(user).redeemUnderlying(amount.mul(2));
      });

      it('decrements recipient collateralizedErc20 balance', async function () {
        expect(await TestCollateralizedErc20.balanceOf(user.address)).to.be.equal(zero);
      });

      it('decrements totalReserve', async function () {
        expect(await TestCollateralizedErc20.totalReserve()).to.be.equal(zero);
      });

      it('emits Redeem event', async function () {
        const event = TestCollateralizedErc20.filters.Redeem();
        // TODO check ammounts on mint event
        expect(event).to.be.not.null;
      });
    });

    describe('for emptying multi-mint non-clean rounding pool', function () {
      beforeEach('redeeming', async function () {
        await TestToken.connect(user).approve(TestCollateralizedErc20.address, amount);
        await TestCollateralizedErc20.connect(user).mint(amount);
        await TestToken.connect(user).transfer(TestCollateralizedErc20.address, amount.div(2));
        await TestToken.connect(user).approve(TestCollateralizedErc20.address, amount);
        await TestCollateralizedErc20.connect(user).mint(amount, {from: user.address});
        await TestCollateralizedErc20.connect(user).redeemUnderlying(ethers.BigNumber.from(1500));
        await TestCollateralizedErc20.connect(user).redeemUnderlying(amount);
      });

      it('decrements recipient collateralizedErc20 balance', async function () {
        expect(await TestCollateralizedErc20.balanceOf(user.address)).to.be.equal(zero);
      });

      it('decrements totalReserve', async function () {
        expect(await TestCollateralizedErc20.totalReserve()).to.be.equal(zero);
      });

      it('emits both Redeem events', async function () {
        const event = TestCollateralizedErc20.filters.Redeem();
        // TODO check ammounts on mint event
        expect(event).to.be.not.null;
      });
    });
  });


  describe('underlying', function () {
    describe('when calling underlying', function () {
      it('returns underlying token', async function () {
          expect(await TestCollateralizedErc20.underlying()).to.be.equal(TestToken.address);
        });
    });
  });

  describe('isUnderlyingEther', function () {
    describe('when calling isUnderlyingEther', function () {
      it('returns false', async function () {
        expect(await TestCollateralizedErc20.isUnderlyingEther()).to.be.equal(false);
      });
    });
  });


});