const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectEvent, expectRevert, balance } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { ethers } = require('ethers');

const KEther = contract.fromArtifact('KEther');
const TestInvokable = contract.fromArtifact('TestInvokable');

function encodeExecute(testType, dataAbi, data) {
  const encodedData = ethers.utils.defaultAbiCoder.encode(dataAbi, data);
  return ethers.utils.defaultAbiCoder.encode(["uint256", "bytes"], [testType, encodedData]);
}

describe('KEther', function () {
  const [ ownerAddress, userAddress, vaultAddress ] = accounts;
  const noopInvokerBalance = new BN(10000);
  const kEtherUnderlyingBalance = new BN(100000);
  const platformRewardBips = new BN(5);
  const poolRewardBips = new BN(20);
  const kEtherUnderlyingBalanceRepayAmount = new BN(100250);
  const kEtherUnderlyingBalanceWithReward = new BN(100200);

  beforeEach(async function () {
    this.kEther = await KEther.new({from: ownerAddress});

    await this.kEther.setPlatformReward(platformRewardBips, {from: ownerAddress});
    await this.kEther.setPoolReward(poolRewardBips, {from: ownerAddress});
    await this.kEther.setPlatformVaultAddress(vaultAddress, {from: ownerAddress});

    this.invokable = await TestInvokable.new({from: ownerAddress});
    await this.invokable.sendTransaction({value: noopInvokerBalance.toString()});

    await this.kEther.mint({value: kEtherUnderlyingBalance.toString()});
  });

  describe('invoke', function () {
    describe('when borrow whole fund with successful repay', function () {

      const resultingPlatformReward = new BN(50);
      const resultingPoolReward = new BN(200);

      beforeEach('invoking', async function () {
        this.vaultStartingBalance = await balance.current(vaultAddress);
        const invokeTo = this.invokable.address;
        const receipt = await this.kEther.invoke(invokeTo, [], kEtherUnderlyingBalance);
        this.logs = receipt.logs;
        this.txHash = receipt.tx;
        this.underlying = await this.kEther.underlying();
      });

      it('increments totalReserve', async function () {
        expect(await this.kEther.totalReserve()).to.be.bignumber.equal(kEtherUnderlyingBalanceWithReward);
      });

      it('emits Reward event', async function () {
        const event = expectEvent.inLogs(this.logs, 'Reward', {
          tokenAddress: this.underlying
        });

        expect(event.args.platformReward).to.be.bignumber.equal(resultingPlatformReward);
        expect(event.args.poolReward).to.be.bignumber.equal(resultingPoolReward);
      });

      it('emits Invocation event', async function () {
        const event = expectEvent.inLogs(this.logs, 'Invocation', {
          invokeTo: this.invokable.address
        });

        expect(event.args.invokeValue).to.be.bignumber.equal(new BN(0));
        expect(event.args.underlyingAmount).to.be.bignumber.equal(kEtherUnderlyingBalance);
      });

      it('emits HelperDump event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, TestInvokable, 'HelperDump', {
          currentTokenAddress: this.underlying,
          isCurrentTokenEther: true
        });

        expect(event.args.currentTokenAmount).to.be.bignumber.equal(kEtherUnderlyingBalance);
        expect(event.args.currentRepaymentAmount).to.be.bignumber.equal(kEtherUnderlyingBalanceRepayAmount);
      });

      it('incrementa vault balance', async function () {
        expect(await balance.current(vaultAddress)).to.be.bignumber.equal(this.vaultStartingBalance.addn(50));
      });
    });

    describe('when forwarding value to payable invocation', function () {

      const resultingPlatformReward = new BN(50);
      const resultingPoolReward = new BN(200);
      const testPayableAmount = new BN(15);

      beforeEach('invoking', async function () {
        this.vaultStartingBalance = await balance.current(vaultAddress);
        const invokeData = encodeExecute(4, ["uint256"], [testPayableAmount.toString()]);
        const invokeTo = this.invokable.address;
        const receipt = await this.kEther.invoke(invokeTo, invokeData, kEtherUnderlyingBalance, {value: testPayableAmount});
        this.logs = receipt.logs;
        this.txHash = receipt.tx;
        this.underlying = await this.kEther.underlying();
      });

      it('increments totalReserve', async function () {
        expect(await this.kEther.totalReserve()).to.be.bignumber.equal(kEtherUnderlyingBalanceWithReward);
      });

      it('emits Reward event', async function () {
        const event = expectEvent.inLogs(this.logs, 'Reward', {
          tokenAddress: this.underlying
        });

        expect(event.args.platformReward).to.be.bignumber.equal(resultingPlatformReward);
        expect(event.args.poolReward).to.be.bignumber.equal(resultingPoolReward);
      });

      it('emits Invocation event', async function () {
        const event = expectEvent.inLogs(this.logs, 'Invocation', {
          invokeTo: this.invokable.address
        });

        expect(event.args.invokeValue).to.be.bignumber.equal(testPayableAmount);
        expect(event.args.underlyingAmount).to.be.bignumber.equal(kEtherUnderlyingBalance);
      });

      it('emits HelperDump event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, TestInvokable, 'HelperDump', {
          currentTokenAddress: this.underlying,
          isCurrentTokenEther: true
        });

        expect(event.args.currentTokenAmount).to.be.bignumber.equal(kEtherUnderlyingBalance);
        expect(event.args.currentRepaymentAmount).to.be.bignumber.equal(kEtherUnderlyingBalanceRepayAmount);
      });

      it('increments vault balance', async function () {
        expect(await balance.current(vaultAddress)).to.be.bignumber.equal(this.vaultStartingBalance.addn(50));
      });
    });

    describe('when borrow whole fund with too high repay', function () {
      const tooMuch = kEtherUnderlyingBalanceWithReward.addn(1).toString();

      it('reverts', async function () {
        const invokeData = encodeExecute(1, ["uint256"], [tooMuch]);
        const invokeTo = this.invokable.address;
        await expectRevert(
          this.kEther.invoke(invokeTo, invokeData, kEtherUnderlyingBalance),
          "KToken: incorrect ending balance");
      });
    });

    describe('when borrow whole fund with too low repay', function () {
      const tooLittle = kEtherUnderlyingBalanceWithReward.subn(1).toString();

      it('reverts', async function () {
        const invokeData = encodeExecute(1, ["uint256"], [tooLittle]);
        const invokeTo = this.invokable.address;
        await expectRevert(
          this.kEther.invoke(invokeTo, invokeData, kEtherUnderlyingBalance),
          "KToken: incorrect ending balance");
      });
    });

    /*
     * ADMIN TESTS
     */

    describe('when setPlatformReward but not admin', function () {
      it('reverts', async function () {
        await expectRevert(
          this.kEther.setPlatformReward(platformRewardBips, {from: userAddress}),
          "Ownable: caller is not the owner");
      });
    });

    describe('when setPoolReward but not admin', function () {
      it('reverts', async function () {
        await expectRevert(
          this.kEther.setPoolReward(poolRewardBips, {from: userAddress}),
          "Ownable: caller is not the owner");
      });
    });

    describe('when setPlatformVaultAddress but not admin', function () {
      it('reverts', async function () {
        await expectRevert(
          this.kEther.setPlatformVaultAddress(vaultAddress, {from: userAddress}),
          "Ownable: caller is not the owner");
      });
    });

    describe('when paused invoking is disabled', function () {
      beforeEach('invoking', async function () {
        await this.kEther.pause({from: ownerAddress});
      });

      it('reverts', async function () {
        const invokeTo = this.invokable.address;
        const invokeData = await this.invokable.contract.methods.execute([]).encodeABI();
        await expectRevert(
          this.kEther.invoke(invokeTo, invokeData, kEtherUnderlyingBalance),
          "Pausable: paused");
      });
    });

    /*
     *  RECURSIVE CALL TESTS
     */

    describe('when kEther invokes kEther', function () {
      it('reverts', async function () {
        const invokeData = await this.kEther.contract.methods
          .invoke(this.invokable.address, "0x", kEtherUnderlyingBalance.toString(10))
          .encodeABI();

        await expectRevert(
          this.kEther.invoke(this.kEther.address, invokeData, kEtherUnderlyingBalance),
          "KToken: cannot invoke this contract");
      });
    });

    describe('when invokable invokes kEther.invoke()', function () {
      it('reverts', async function () {
        // (A) Invoker: invoke -> invokable fallback(), send whole kEther pool
        const invokableRunInvokeData = await this.kEther.contract.methods
          .invoke(this.invokable.address, "0x", kEtherUnderlyingBalance.toString(10))
          .encodeABI();

        // (B) Invokable: invoke -> (A)
        const invokeData = encodeExecute(3, ["address", "bytes"], [this.kEther.address, invokableRunInvokeData]);

        // (C) Invoker: invoke -> (B), send whole kEther pool
        const invoke = this.kEther.invoke(this.invokable.address, invokeData, kEtherUnderlyingBalance);

        await expectRevert(invoke, "ReentrancyGuard: reentrant call");
      });
    });

    describe('when invokable invokes kEther.mint()', function () {
      it('reverts', async function () {
        // (A) KEther: mint
        const invokableRunInvokeAddress = await this.kEther.address;
        const invokableRunInvokeData = await this.kEther.contract.methods
          .mint()
          .encodeABI();

        // (B) Invokable: invoke -> (A)
        const invokeTo = this.invokable.address;
        const invokeData = encodeExecute(3, ["address", "bytes"], [invokableRunInvokeAddress, invokableRunInvokeData]);

        // (C) Invoker: invoke -> (B), send whole kEther pool
        const invoke = this.kEther.invoke(invokeTo, invokeData, kEtherUnderlyingBalance, {value: 1});

        await expectRevert(invoke, "ReentrancyGuard: reentrant call");
      });
    });

    describe('when invokable invokes kEther.redeem()', function () {
      beforeEach('invoking', async function () {
        invokeTo = this.kEther.address;
        invokeData = this.kEther.contract.methods.mint().encodeABI();
        await this.invokable.invoke(invokeTo, invokeData, {value: 1000});
      });

      it('reverts', async function () {
        // (A) KEther: mint
        const invokableRunInvokeAddress = await this.kEther.address;
        const invokableRunInvokeData = await this.kEther.contract.methods
          .redeem(1000)
          .encodeABI();

        // (B) Invokable: invoke -> (A)
        const invokeTo = this.invokable.address;
        const invokeData = encodeExecute(3, ["address", "bytes"], [invokableRunInvokeAddress, invokableRunInvokeData]);

        // (C) Invoker: invoke -> (B), send whole kEther pool
        const invoke = this.kEther.invoke(invokeTo, invokeData, kEtherUnderlyingBalance);

        await expectRevert(invoke, "ReentrancyGuard: reentrant call");
      });
    });

    describe('when invokable invokes kEther.redeemUnderlying()', function () {
      beforeEach('invoking', async function () {
        invokeTo = this.kEther.address;
        invokeData = this.kEther.contract.methods.mint().encodeABI();
        await this.invokable.invoke(invokeTo, invokeData, {value: 1000});
      });

      it('reverts', async function () {
        // (A) KEther: redeemUnderlying
        const b = (await this.kEther.balanceOfUnderlying(this.invokable.address)).toString();
        const invokableRunInvokeAddress = await this.kEther.address;
        const invokableRunInvokeData = await this.kEther.contract.methods
          .redeemUnderlying(1)
          .encodeABI();

        // (B) Invokable: invoke -> (A)
        const invokeTo = this.invokable.address;
        const invokeData = encodeExecute(3, ["address", "bytes"], [invokableRunInvokeAddress, invokableRunInvokeData]);

        // (C) Invoker: invoke -> (B), send whole kEther pool
        const invoke = this.kEther.invoke(invokeTo, invokeData, kEtherUnderlyingBalance);

        await expectRevert(invoke, "ReentrancyGuard: reentrant call");
      });
    });
  });
});