const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectEvent, expectRevert, balance } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const TestToken = contract.fromArtifact('TestToken');
const TestCollateralizedErc20 = contract.fromArtifact('TestCollateralizedErc20');

describe('CollateralizedErc20', function () {
  const [ ownerAddress, userAddress ] = accounts;

  beforeEach(async function () {
    this.erc20 = await TestToken.new("Test Token", "TT", 18, {from: ownerAddress});
    this.collateralizedErc20 = await TestCollateralizedErc20.new(this.erc20.address, "Collateralized TT", "colTT", 18, {from: ownerAddress});
    await this.erc20.mint(await balance.current(ownerAddress), {from: ownerAddress});
    await this.erc20.mint(await balance.current(userAddress), {from: userAddress});
  });

  describe('mint', function () {
    const amount = new BN(1000);
    const amountAfterPayback = new BN(500);

    describe('when supplying more than balance', function () {
      beforeEach('minting', async function () {
        this.balance = await this.erc20.balanceOf(userAddress);
      });

      it('reverts', async function () {
        await this.erc20.approve(this.collateralizedErc20.address, this.balance.addn(1), {from: ownerAddress});
        await expectRevert(
          this.collateralizedErc20.mint(this.balance.addn(1), {from: userAddress}),
          'ERC20: transfer amount exceeds balance');
      });
    });

    describe('when supplying more than approval', function () {
      beforeEach('minting', async function () {
        this.balance = await this.erc20.balanceOf(userAddress);
      });

      it('reverts', async function () {
        await this.erc20.approve(this.collateralizedErc20.address, this.balance.subn(1), {from: ownerAddress});
        await expectRevert(
          this.collateralizedErc20.mint(this.balance, {from: userAddress}),
          'UnlimitedApprovalDetailedErc20: transfer amount exceeds allowance');
      });
    });

    describe('for an empty pool', function () {
      beforeEach('minting', async function () {
        await this.erc20.approve(this.collateralizedErc20.address, amount, {from: userAddress});
        const { logs } = await this.collateralizedErc20.mint(amount, {from: userAddress});
        this.logs = logs
      });

      it('increments recipient collateralizedErc20 balance', async function () {
        expect(await this.collateralizedErc20.balanceOf(userAddress)).to.be.bignumber.equal(amount);
      });

      it('increments totalReserve', async function () {
        expect(await this.collateralizedErc20.totalReserve()).to.be.bignumber.equal(amount);
      });

      it('emits Mint event', async function () {
        const event = expectEvent.inLogs(this.logs, 'Mint', {
          minter: userAddress
        });

        expect(event.args.tokenAmount).to.be.bignumber.equal(amount);
        expect(event.args.kTokenAmount).to.be.bignumber.equal(amount);
      });
    });

    describe('for a not empty pool', function () {
      beforeEach('minting', async function () {
        await this.erc20.approve(this.collateralizedErc20.address, amount, {from: userAddress});
        await this.collateralizedErc20.mint(amount, {from: userAddress});
        await this.erc20.transfer(this.collateralizedErc20.address, amount, {from: userAddress});
        await this.erc20.approve(this.collateralizedErc20.address, amount, {from: userAddress});
        const { logs } = await this.collateralizedErc20.mint(amount, {from: userAddress});
        this.logs = logs;
      });

      it('increments recipient collateralizedErc20 balance', async function () {
        expect(await this.collateralizedErc20.balanceOf(userAddress)).to.be.bignumber.equal(amount.add(amountAfterPayback));
      });

      it('increments totalReserve', async function () {
        expect(await this.collateralizedErc20.totalReserve()).to.be.bignumber.equal(amount.muln(3));
      });

      it('emits Mint event', async function () {
        const event = expectEvent.inLogs(this.logs, 'Mint', {
          minter: userAddress
        });

        expect(event.args.tokenAmount).to.be.bignumber.equal(amount);
        expect(event.args.kTokenAmount).to.be.bignumber.equal(amountAfterPayback);
      });
    });

    describe('for non-clean rounding', function () {
      const amountAfterPaybackFloor = new BN(333);

      beforeEach('minting', async function () {
        await this.erc20.approve(this.collateralizedErc20.address, amount, {from: userAddress});
        await this.collateralizedErc20.mint(amount, {from: userAddress});
        await this.erc20.transfer(this.collateralizedErc20.address, amount.muln(2), {from: userAddress});
        await this.erc20.approve(this.collateralizedErc20.address, amount, {from: userAddress});
        const { logs } = await this.collateralizedErc20.mint(amount, {from: userAddress});
        this.logs = logs;
      });

      it('increments recipient collateralizedErc20 balance', async function () {
        expect(await this.collateralizedErc20.balanceOf(userAddress)).to.be.bignumber.equal(amount.add(amountAfterPaybackFloor));
      });

      it('increments totalReserve', async function () {
        expect(await this.collateralizedErc20.totalReserve()).to.be.bignumber.equal(amount.muln(4));
      });

      it('emits Mint event', async function () {
        const event = expectEvent.inLogs(this.logs, 'Mint', {
          minter: userAddress
        });

        expect(event.args.tokenAmount).to.be.bignumber.equal(amount);
        expect(event.args.kTokenAmount).to.be.bignumber.equal(amountAfterPaybackFloor);
      });
    });
  });

  describe('redeem', function () {
    const zero = new BN(0);
    const amount = new BN(1000);
    const amountAfterPayback = new BN(500);

    describe('when redeeming with zero balance', function () {
      beforeEach('redeem', async function () {
        this.balance = await this.collateralizedErc20.balanceOf(userAddress);
      });

      it('reverts', async function () {
        await expectRevert(
          this.collateralizedErc20.redeem(this.balance.addn(1), {from: userAddress}),
          'CollateralizedToken: no supply');
      });
    });

    describe('when redeeming more than balance', function () {
      beforeEach('redeem', async function () {
        await this.erc20.approve(this.collateralizedErc20.address, amount, {from: userAddress});
        await this.collateralizedErc20.mint(amount, {from: userAddress});
        this.balance = await this.collateralizedErc20.balanceOf(userAddress);
      });

      it('reverts', async function () {
        await expectRevert(
          this.collateralizedErc20.redeem(this.balance.addn(1), {from: userAddress}),
          'ERC20: burn amount exceeds balance');
      });
    });

    describe('for a single-mint pool', function () {
      beforeEach('redeeming', async function () {
        await this.erc20.approve(this.collateralizedErc20.address, amount, {from: userAddress});
        await this.collateralizedErc20.mint(amount, {from: userAddress});
        const { logs } = await this.collateralizedErc20.redeem(amount, {from: userAddress});
        this.logs = logs;
      });

      it('decrements recipient collateralizedErc20 balance', async function () {
        expect(await this.collateralizedErc20.balanceOf(userAddress)).to.be.bignumber.equal(zero);
      });

      it('decrements totalReserve', async function () {
        expect(await this.collateralizedErc20.totalReserve()).to.be.bignumber.equal(zero);
      });

      it('emits Redeem event', async function () {
        const event = expectEvent.inLogs(this.logs, 'Redeem', {
          redeemer: userAddress
        });

        expect(event.args.tokenAmount).to.be.bignumber.equal(amount);
        expect(event.args.kTokenAmount).to.be.bignumber.equal(amount);
      });
    });

    describe('for a multi-mint pool', function () {
      beforeEach('redeeming', async function () {
        await this.erc20.approve(this.collateralizedErc20.address, amount, {from: userAddress});
        await this.collateralizedErc20.mint(amount, {from: userAddress});
        await this.erc20.transfer(this.collateralizedErc20.address, amount, {from: userAddress});
        await this.erc20.approve(this.collateralizedErc20.address, amount, {from: userAddress});
        await this.collateralizedErc20.mint(amount, {from: userAddress});
        const { logs } = await this.collateralizedErc20.redeem(amountAfterPayback, {from: userAddress});
        this.logs = logs;
      });

      it('decrements recipient collateralizedErc20 balance', async function () {
        expect(await this.collateralizedErc20.balanceOf(userAddress)).to.be.bignumber.equal(amount);
      });

      it('decrements totalReserve', async function () {
        expect(await this.collateralizedErc20.totalReserve()).to.be.bignumber.equal(amount.muln(2));
      });

      it('emits Redeem event', async function () {
        const event = expectEvent.inLogs(this.logs, 'Redeem', {
          redeemer: userAddress
        });

        expect(event.args.tokenAmount).to.be.bignumber.equal(amount);
        expect(event.args.kTokenAmount).to.be.bignumber.equal(amountAfterPayback);
      });
    });

    describe('for emptying multi-mint pool', function () {
      beforeEach('redeeming', async function () {
        await this.erc20.approve(this.collateralizedErc20.address, amount, {from: userAddress});
        await this.collateralizedErc20.mint(amount, {from: userAddress});
        await this.erc20.transfer(this.collateralizedErc20.address, amount, {from: userAddress});
        await this.erc20.approve(this.collateralizedErc20.address, amount, {from: userAddress});
        await this.collateralizedErc20.mint(amount, {from: userAddress});
        await this.collateralizedErc20.redeem(amountAfterPayback, {from: userAddress});
        const { logs } = await this.collateralizedErc20.redeem(amount, {from: userAddress});
        this.logs = logs;
      });

      it('decrements recipient collateralizedErc20 balance', async function () {
        expect(await this.collateralizedErc20.balanceOf(userAddress)).to.be.bignumber.equal(zero);
      });

      it('decrements totalReserve', async function () {
        expect(await this.collateralizedErc20.totalReserve()).to.be.bignumber.equal(zero);
      });

      it('emits Redeem event', async function () {
        const event = expectEvent.inLogs(this.logs, 'Redeem', {
          redeemer: userAddress
        });

        expect(event.args.tokenAmount).to.be.bignumber.equal(amount.muln(2));
        expect(event.args.kTokenAmount).to.be.bignumber.equal(amount);
      });
    });

    describe('for emptying multi-mint non-clean rounding pool', function () {
      beforeEach('redeeming', async function () {
        await this.erc20.approve(this.collateralizedErc20.address, amount, {from: userAddress});
        await this.collateralizedErc20.mint(amount, {from: userAddress});
        await this.erc20.transfer(this.collateralizedErc20.address, amount.divn(2), {from: userAddress});
        await this.erc20.approve(this.collateralizedErc20.address, amount, {from: userAddress});
        await this.collateralizedErc20.mint(amount, {from: userAddress});
        this.logs = (await this.collateralizedErc20.redeem(amount, {from: userAddress})).logs;
        this.logs2 = (await this.collateralizedErc20.redeem(new BN(666), {from: userAddress})).logs;
      });

      it('decrements recipient collateralizedErc20 balance', async function () {
        expect(await this.collateralizedErc20.balanceOf(userAddress)).to.be.bignumber.equal(zero);
      });

      it('decrements totalReserve', async function () {
        expect(await this.collateralizedErc20.totalReserve()).to.be.bignumber.equal(zero);
      });

      it('emits both Redeem events', async function () {
        const event = expectEvent.inLogs(this.logs, 'Redeem', {
          redeemer: userAddress
        });

        expect(event.args.tokenAmount).to.be.bignumber.equal(new BN(1500));
        expect(event.args.kTokenAmount).to.be.bignumber.equal(amount);

        const event2 = expectEvent.inLogs(this.logs2, 'Redeem', {
          redeemer: userAddress
        });

        expect(event2.args.tokenAmount).to.be.bignumber.equal(amount);
        expect(event2.args.kTokenAmount).to.be.bignumber.equal(new BN(666));
      });
    });
  });

  describe('redeemUnderlying', function () {
    const zero = new BN(0);
    const amount = new BN(1000);
    const amountAfterPayback = new BN(500);

    describe('when redeeming with zero balance', function () {
      beforeEach('redeem', async function () {
        this.balance = await this.collateralizedErc20.balanceOfUnderlying(userAddress);
      });

      it('reverts', async function () {

        await expectRevert(
          this.collateralizedErc20.redeemUnderlying(this.balance.addn(1), {from: userAddress}),
          'CollateralizedToken: no reserve');
      });
    });

    describe('when redeeming more than balance', function () {
      beforeEach('redeem', async function () {
        await this.erc20.approve(this.collateralizedErc20.address, amount, {from: userAddress});
        await this.collateralizedErc20.mint(amount, {from: userAddress});
        this.balance = await this.collateralizedErc20.balanceOf(userAddress);
      });

      it('reverts', async function () {
        await expectRevert(
          this.collateralizedErc20.redeemUnderlying(this.balance.addn(1), {from: userAddress}),
          'ERC20: burn amount exceeds balance');
      });
    });

    describe('for a single-mint pool', function () {
      beforeEach('redeeming', async function () {
        await this.erc20.approve(this.collateralizedErc20.address, amount, {from: userAddress});
        await this.collateralizedErc20.mint(amount, {from: userAddress});
        const { logs } = await this.collateralizedErc20.redeemUnderlying(amount, {from: userAddress});
        this.logs = logs;
      });

      it('decrements recipient collateralizedErc20 balance', async function () {
        expect(await this.collateralizedErc20.balanceOf(userAddress)).to.be.bignumber.equal(zero);
      });

      it('decrements totalReserve', async function () {
        expect(await this.collateralizedErc20.totalReserve()).to.be.bignumber.equal(zero);
      });

      it('emits Redeem event', async function () {
        const event = expectEvent.inLogs(this.logs, 'Redeem', {
          redeemer: userAddress
        });

        expect(event.args.tokenAmount).to.be.bignumber.equal(amount);
        expect(event.args.kTokenAmount).to.be.bignumber.equal(amount);
      });
    });

    describe('for a multi-mint pool', function () {
      beforeEach('redeeming', async function () {
        await this.erc20.approve(this.collateralizedErc20.address, amount, {from: userAddress});
        await this.collateralizedErc20.mint(amount, {from: userAddress});
        await this.erc20.transfer(this.collateralizedErc20.address, amount, {from: userAddress});
        await this.erc20.approve(this.collateralizedErc20.address, amount, {from: userAddress});
        await this.collateralizedErc20.mint(amount, {from: userAddress});
        const { logs } = await this.collateralizedErc20.redeemUnderlying(amount, {from: userAddress});
        this.logs = logs;
      });

      it('decrements recipient collateralizedErc20 balance', async function () {
        expect(await this.collateralizedErc20.balanceOf(userAddress)).to.be.bignumber.equal(amount);
      });

      it('decrements totalReserve', async function () {
        expect(await this.collateralizedErc20.totalReserve()).to.be.bignumber.equal(amount.muln(2));
      });

      it('emits Redeem event', async function () {
        const event = expectEvent.inLogs(this.logs, 'Redeem', {
          redeemer: userAddress
        });

        expect(event.args.tokenAmount).to.be.bignumber.equal(amount);
        expect(event.args.kTokenAmount).to.be.bignumber.equal(amountAfterPayback);
      });
    });

    describe('for emptying multi-mint pool', function () {
      beforeEach('redeeming', async function () {
        await this.erc20.approve(this.collateralizedErc20.address, amount, {from: userAddress});
        await this.collateralizedErc20.mint(amount, {from: userAddress});
        await this.erc20.transfer(this.collateralizedErc20.address, amount, {from: userAddress});
        await this.erc20.approve(this.collateralizedErc20.address, amount, {from: userAddress});
        await this.collateralizedErc20.mint(amount, {from: userAddress});
        await this.collateralizedErc20.redeemUnderlying(amount, {from: userAddress});
        const { logs } = await this.collateralizedErc20.redeemUnderlying(amount.muln(2), {from: userAddress});
        this.logs = logs;
      });

      it('decrements recipient collateralizedErc20 balance', async function () {
        expect(await this.collateralizedErc20.balanceOf(userAddress)).to.be.bignumber.equal(zero);
      });

      it('decrements totalReserve', async function () {
        expect(await this.collateralizedErc20.totalReserve()).to.be.bignumber.equal(zero);
      });

      it('emits Redeem event', async function () {
        const event = expectEvent.inLogs(this.logs, 'Redeem', {
          redeemer: userAddress
        });

        expect(event.args.tokenAmount).to.be.bignumber.equal(amount.muln(2));
        expect(event.args.kTokenAmount).to.be.bignumber.equal(amount);
      });
    });

    describe('for emptying multi-mint non-clean rounding pool', function () {
      beforeEach('redeeming', async function () {
        await this.erc20.approve(this.collateralizedErc20.address, amount, {from: userAddress});
        await this.collateralizedErc20.mint(amount, {from: userAddress});
        await this.erc20.transfer(this.collateralizedErc20.address, amount.divn(2), {from: userAddress});
        await this.erc20.approve(this.collateralizedErc20.address, amount, {from: userAddress});
        await this.collateralizedErc20.mint(amount, {from: userAddress});
        this.logs = (await this.collateralizedErc20.redeemUnderlying(new BN(1500), {from: userAddress})).logs;
        this.logs2 = (await this.collateralizedErc20.redeemUnderlying(amount, {from: userAddress})).logs;
      });

      it('decrements recipient collateralizedErc20 balance', async function () {
        expect(await this.collateralizedErc20.balanceOf(userAddress)).to.be.bignumber.equal(zero);
      });

      it('decrements totalReserve', async function () {
        expect(await this.collateralizedErc20.totalReserve()).to.be.bignumber.equal(zero);
      });

      it('emits both Redeem events', async function () {
        const event = expectEvent.inLogs(this.logs, 'Redeem', {
          redeemer: userAddress
        });

        expect(event.args.tokenAmount).to.be.bignumber.equal(new BN(1500));
        expect(event.args.kTokenAmount).to.be.bignumber.equal(amount);

        const event2 = expectEvent.inLogs(this.logs2, 'Redeem', {
          redeemer: userAddress
        });

        expect(event2.args.tokenAmount).to.be.bignumber.equal(amount);
        expect(event2.args.kTokenAmount).to.be.bignumber.equal(new BN(666));
      });
    });
  });

  describe('underlying', function () {
    describe('when calling underlying', function () {
      it('returns underlying token', async function () {
          expect(await this.collateralizedErc20.underlying()).to.be.equal(this.erc20.address);
        });
    });
  });

  describe('isUnderlyingEther', function () {
    describe('when calling isUnderlyingEther', function () {
      it('returns false', async function () {
        expect(await this.collateralizedErc20.isUnderlyingEther()).to.be.equal(false);
      });
    });
  });
});