const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectEvent, expectRevert, balance } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const TestCollateralizedEther = contract.fromArtifact('TestCollateralizedEther');

const ETHER_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000001";

describe('CollateralizedEther', function () {
  const [ ownerAddress, userAddress ] = accounts;

  beforeEach(async function () {
    this.collateralizedEther = await TestCollateralizedEther.new("Collateralized Ether", "colETH", 18, {from: ownerAddress});
  });

  describe('mint', function () {
    const amount = new BN(1000);
    const amountAfterPayback = new BN(500);

    describe('when supplying more than balance', function () {
      beforeEach('minting', async function () {
        this.balance = await balance.current(userAddress);
      });

      it('reverts', async function () {
        await expectRevert(
          this.collateralizedEther.mint({from: userAddress, value: this.balance.addn(1)}),
          'sender doesn\'t have enough funds to send tx.');
      });
    });

    describe('for an empty pool', function () {
      beforeEach('minting', async function () {
        const { logs } = await this.collateralizedEther.mint({from: userAddress, value: amount});
        this.logs = logs
      });

      it('increments recipient collateralizedEther balance', async function () {
        expect(await this.collateralizedEther.balanceOf(userAddress)).to.be.bignumber.equal(amount);
      });

      it('increments totalReserve', async function () {
        expect(await this.collateralizedEther.totalReserve()).to.be.bignumber.equal(amount);
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
        await this.collateralizedEther.mint({from: userAddress, value: amount});
        await this.collateralizedEther.sendTransaction({from: userAddress, value: amount});
        const { logs } = await this.collateralizedEther.mint({from: userAddress, value: amount});
        this.logs = logs;
      });

      it('increments recipient collateralizedEther balance', async function () {
        expect(await this.collateralizedEther.balanceOf(userAddress)).to.be.bignumber.equal(amount.add(amountAfterPayback));
      });

      it('increments totalReserve', async function () {
        expect(await this.collateralizedEther.totalReserve()).to.be.bignumber.equal(amount.muln(3));
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
        await this.collateralizedEther.mint({from: userAddress, value: amount});
        await this.collateralizedEther.sendTransaction({from: userAddress, value: amount.muln(2)});
        const { logs } = await this.collateralizedEther.mint({from: userAddress, value: amount});
        this.logs = logs;
      });

      it('increments recipient collateralizedEther balance', async function () {
        expect(await this.collateralizedEther.balanceOf(userAddress)).to.be.bignumber.equal(amount.add(amountAfterPaybackFloor));
      });

      it('increments totalReserve', async function () {
        expect(await this.collateralizedEther.totalReserve()).to.be.bignumber.equal(amount.muln(4));
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
        this.balance = await this.collateralizedEther.balanceOf(userAddress);
      });

      it('reverts', async function () {
        await expectRevert(
          this.collateralizedEther.redeem(this.balance.addn(1), {from: userAddress}),
          'CollateralizedToken: no supply');
      });
    });

    describe('when redeeming more than balance', function () {
      beforeEach('redeem', async function () {
        await this.collateralizedEther.mint({from: userAddress, value: amount});
        this.balance = await this.collateralizedEther.balanceOf(userAddress);
      });

      it('reverts', async function () {
        await expectRevert(
          this.collateralizedEther.redeem(this.balance.addn(1), {from: userAddress}),
          'ERC20: burn amount exceeds balance');
      });
    });

    describe('for a single-mint pool', function () {
      beforeEach('redeeming', async function () {
        await this.collateralizedEther.mint({from: userAddress, value: amount});
        const { logs } = await this.collateralizedEther.redeem(amount, {from: userAddress});
        this.logs = logs;
      });

      it('decrements recipient collateralizedEther balance', async function () {
        expect(await this.collateralizedEther.balanceOf(userAddress)).to.be.bignumber.equal(zero);
      });

      it('decrements totalReserve', async function () {
        expect(await this.collateralizedEther.totalReserve()).to.be.bignumber.equal(zero);
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
        await this.collateralizedEther.mint({from: userAddress, value: amount});
        await this.collateralizedEther.sendTransaction({from: userAddress, value: amount});
        await this.collateralizedEther.mint({from: userAddress, value: amount});
        const { logs } = await this.collateralizedEther.redeem(amountAfterPayback, {from: userAddress});
        this.logs = logs;
      });

      it('decrements recipient collateralizedEther balance', async function () {
        expect(await this.collateralizedEther.balanceOf(userAddress)).to.be.bignumber.equal(amount);
      });

      it('decrements totalReserve', async function () {
        expect(await this.collateralizedEther.totalReserve()).to.be.bignumber.equal(amount.muln(2));
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
        await this.collateralizedEther.mint({from: userAddress, value: amount});
        await this.collateralizedEther.sendTransaction({from: userAddress, value: amount});
        await this.collateralizedEther.mint({from: userAddress, value: amount});
        await this.collateralizedEther.redeem(amountAfterPayback, {from: userAddress});
        const { logs } = await this.collateralizedEther.redeem(amount, {from: userAddress});
        this.logs = logs;
      });

      it('decrements recipient collateralizedEther balance', async function () {
        expect(await this.collateralizedEther.balanceOf(userAddress)).to.be.bignumber.equal(zero);
      });

      it('decrements totalReserve', async function () {
        expect(await this.collateralizedEther.totalReserve()).to.be.bignumber.equal(zero);
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
        await this.collateralizedEther.mint({from: userAddress, value: amount});
        await this.collateralizedEther.sendTransaction({from: userAddress, value: amount.divn(2)});
        await this.collateralizedEther.mint({from: userAddress, value: amount});
        this.logs = (await this.collateralizedEther.redeem(amount, {from: userAddress})).logs;
        this.logs2 = (await this.collateralizedEther.redeem(new BN(666), {from: userAddress})).logs;
      });

      it('decrements recipient collateralizedEther balance', async function () {
        expect(await this.collateralizedEther.balanceOf(userAddress)).to.be.bignumber.equal(zero);
      });

      it('decrements totalReserve', async function () {
        expect(await this.collateralizedEther.totalReserve()).to.be.bignumber.equal(zero);
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
        this.balance = await this.collateralizedEther.balanceOfUnderlying(userAddress);
      });

      it('reverts', async function () {

        await expectRevert(
          this.collateralizedEther.redeemUnderlying(this.balance.addn(1), {from: userAddress}),
          'CollateralizedToken: no reserve');
      });
    });

    describe('when redeeming more than balance', function () {
      beforeEach('redeem', async function () {
        await this.collateralizedEther.mint({from: userAddress, value: amount});
        this.balance = await this.collateralizedEther.balanceOf(userAddress);
      });

      it('reverts', async function () {
        await expectRevert(
          this.collateralizedEther.redeemUnderlying(this.balance.addn(1), {from: userAddress}),
          'ERC20: burn amount exceeds balance');
      });
    });

    describe('for a single-mint pool', function () {
      beforeEach('redeeming', async function () {
        await this.collateralizedEther.mint({from: userAddress, value: amount});
        const {logs} = await this.collateralizedEther.redeemUnderlying(amount, {from: userAddress});
        this.logs = logs;
      });

      it('decrements recipient collateralizedEther balance', async function () {
        expect(await this.collateralizedEther.balanceOf(userAddress)).to.be.bignumber.equal(zero);
      });

      it('decrements totalReserve', async function () {
        expect(await this.collateralizedEther.totalReserve()).to.be.bignumber.equal(zero);
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
        await this.collateralizedEther.mint({from: userAddress, value: amount});
        await this.collateralizedEther.sendTransaction({from: userAddress, value: amount});
        await this.collateralizedEther.mint({from: userAddress, value: amount});
        const {logs} = await this.collateralizedEther.redeemUnderlying(amount, {from: userAddress});
        this.logs = logs;
      });

      it('decrements recipient collateralizedEther balance', async function () {
        expect(await this.collateralizedEther.balanceOf(userAddress)).to.be.bignumber.equal(amount);
      });

      it('decrements totalReserve', async function () {
        expect(await this.collateralizedEther.totalReserve()).to.be.bignumber.equal(amount.muln(2));
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
        await this.collateralizedEther.mint({from: userAddress, value: amount});
        await this.collateralizedEther.sendTransaction({from: userAddress, value: amount});
        await this.collateralizedEther.mint({from: userAddress, value: amount});
        await this.collateralizedEther.redeemUnderlying(amount, {from: userAddress});
        const {logs} = await this.collateralizedEther.redeemUnderlying(amount.muln(2), {from: userAddress});
        this.logs = logs;
      });

      it('decrements recipient collateralizedEther balance', async function () {
        expect(await this.collateralizedEther.balanceOf(userAddress)).to.be.bignumber.equal(zero);
      });

      it('decrements totalReserve', async function () {
        expect(await this.collateralizedEther.totalReserve()).to.be.bignumber.equal(zero);
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
        await this.collateralizedEther.mint({from: userAddress, value: amount});
        await this.collateralizedEther.sendTransaction({from: userAddress, value: amount.divn(2)});
        await this.collateralizedEther.mint({from: userAddress, value: amount});
        this.logs = (await this.collateralizedEther.redeemUnderlying(new BN(1500), {from: userAddress})).logs;
        this.logs2 = (await this.collateralizedEther.redeemUnderlying(amount, {from: userAddress})).logs;
      });

      it('decrements recipient collateralizedEther balance', async function () {
        expect(await this.collateralizedEther.balanceOf(userAddress)).to.be.bignumber.equal(zero);
      });

      it('decrements totalReserve', async function () {
        expect(await this.collateralizedEther.totalReserve()).to.be.bignumber.equal(zero);
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
        expect(await this.collateralizedEther.underlying()).to.be.equal(ETHER_TOKEN_ADDRESS);
      });
    });
  });

  describe('isUnderlyingEther', function () {
    describe('when calling isUnderlyingEther', function () {
      it('returns true', async function () {
        expect(await this.collateralizedEther.isUnderlyingEther()).to.be.equal(true);
      });
    });
  });
});