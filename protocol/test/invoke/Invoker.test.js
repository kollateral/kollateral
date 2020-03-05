const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectEvent, expectRevert, balance } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { ethers } = require('ethers');

const ETHER_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000001";
const OTHER_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000002";


const Invoker = contract.fromArtifact('Invoker');
const KollateralLiquidityProxy = contract.fromArtifact('KollateralLiquidityProxy');
const KEther = contract.fromArtifact('KEther');
const TestToken = contract.fromArtifact('TestToken');
const KErc20 = contract.fromArtifact('KErc20');
const TestInvokable = contract.fromArtifact('TestInvokable');

function encodeExecute(testType, dataAbi, data) {
  const encodedData = ethers.utils.defaultAbiCoder.encode(dataAbi, data);
  return ethers.utils.defaultAbiCoder.encode(["uint256", "bytes"], [testType, encodedData]);
}

describe('Invoker', function () {
  describe('for Ether borrows', function () {
    const [ ownerAddress, userAddress, kEtherVaultAddress, invokerVaultAddress ] = accounts;
    const noopInvokerBalance = new BN(10000);
    const kEtherUnderlyingBalance = new BN(100000);
  
    beforeEach(async function () {
      this.kEther = await KEther.new({from: ownerAddress});
      await this.kEther.setPlatformReward(5, {from: ownerAddress});
      await this.kEther.setPoolReward(20, {from: ownerAddress});
      await this.kEther.setPlatformVaultAddress(kEtherVaultAddress, {from: ownerAddress});
  
      this.proxy = await KollateralLiquidityProxy.new({from: ownerAddress});
      await this.proxy.registerPool(ETHER_TOKEN_ADDRESS, this.kEther.address, {from: ownerAddress});
  
      this.kEther2 = await KEther.new({from: ownerAddress});
      await this.kEther2.setPlatformReward(5, {from: ownerAddress});
      await this.kEther2.setPoolReward(20, {from: ownerAddress});
      await this.kEther2.setPlatformVaultAddress(kEtherVaultAddress, {from: ownerAddress});
  
      this.proxy2 = await KollateralLiquidityProxy.new({from: ownerAddress});
      await this.proxy2.registerPool(ETHER_TOKEN_ADDRESS, this.kEther2.address, {from: ownerAddress});
  
      this.invoker = await Invoker.new({from: ownerAddress});
      await this.invoker.setLiquidityProxies(ETHER_TOKEN_ADDRESS, [this.proxy.address, this.proxy2.address], {from: ownerAddress});
      await this.invoker.setPlatformReward(1, {from: ownerAddress});
      await this.invoker.setPoolReward(4, {from: ownerAddress});
      await this.invoker.setPoolRewardAddress(ETHER_TOKEN_ADDRESS, this.kEther.address, {from: ownerAddress});
      await this.invoker.setPlatformVaultAddress(invokerVaultAddress, {from: ownerAddress});
  
      this.invokable = await TestInvokable.new({from: ownerAddress});
      await this.invokable.sendTransaction({value: noopInvokerBalance.toString()});
  
      await this.kEther.mint({value: kEtherUnderlyingBalance.toString()});
      await this.kEther2.mint({value: kEtherUnderlyingBalance.toString()});
    });
  
    describe('invoke', function () {
      describe('when borrow single pool with successful repay', function () {
        const underlyingAmount = kEtherUnderlyingBalance;
        const underlyingBalanceRepayAmount = new BN(100300);
        const underlyingBalanceWithReward = new BN(100240);
        const resultingPlatformReward = new BN(10);
        const resultingPoolReward = new BN(40);
  
        beforeEach('invoking', async function () {
          this.invokerVaultStartingBalance = await balance.current(invokerVaultAddress);
          const invokeTo = this.invokable.address;
          const receipt = await this.invoker.invoke(invokeTo, [], ETHER_TOKEN_ADDRESS, underlyingAmount);
          this.logs = receipt.logs;
          this.txHash = receipt.tx;
          this.underlying = await this.kEther.underlying();
        });
  
        it('increments native totalReserve', async function () {
          expect(await this.kEther.totalReserve()).to.be.bignumber.equal(underlyingBalanceWithReward);
        });
  
        it('emits Reward event', async function () {
          const event = this.logs[this.logs.length - 1];
  
          expect(event.args.tokenAddress).to.be.equal(this.underlying);
          expect(event.args.platformReward).to.be.bignumber.equal(resultingPlatformReward);
          expect(event.args.poolReward).to.be.bignumber.equal(resultingPoolReward);
        });
  
        it('emits Invocation event', async function () {
          const event = this.logs[0];
  
          expect(event.args.invokeTo).to.be.equal(this.invokable.address);
          expect(event.args.invokeValue).to.be.bignumber.equal(new BN(0));
          expect(event.args.underlyingAmount).to.be.bignumber.equal(underlyingAmount);
        });
  
        it('emits HelperDump event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, TestInvokable, 'HelperDump', {
            currentTokenAddress: this.underlying,
            isCurrentTokenEther: true
          });
  
          expect(event.args.currentTokenAmount).to.be.bignumber.equal(underlyingAmount);
          expect(event.args.currentRepaymentAmount).to.be.bignumber.equal(underlyingBalanceRepayAmount);
        });
  
        it('increments kEther vault balance', async function () {
          expect(await balance.current(invokerVaultAddress)).to.be.bignumber.equal(this.invokerVaultStartingBalance.addn(10));
        });
      });
  
      describe('when forward payable with successful repay', function () {
        const underlyingAmount = kEtherUnderlyingBalance;
        const underlyingBalanceRepayAmount = new BN(100300);
        const underlyingBalanceWithReward = new BN(100240);
        const resultingPlatformReward = new BN(10);
        const resultingPoolReward = new BN(40);
        const testPayableAmount = new BN(15);
  
        beforeEach('invoking', async function () {
          this.invokerVaultStartingBalance = await balance.current(invokerVaultAddress);
          const invokeTo = this.invokable.address;
          const invokeData = encodeExecute(4, ["uint256"], [testPayableAmount.toString()]);
          const receipt = await this.invoker.invoke(invokeTo, invokeData, ETHER_TOKEN_ADDRESS, underlyingAmount, {value: testPayableAmount});
          this.logs = receipt.logs;
          this.txHash = receipt.tx;
          this.underlying = await this.kEther.underlying();
        });
  
        it('increments native totalReserve', async function () {
          expect(await this.kEther.totalReserve()).to.be.bignumber.equal(underlyingBalanceWithReward);
        });
  
        it('emits Reward event', async function () {
          const event = this.logs[this.logs.length - 1];
  
          expect(event.args.tokenAddress).to.be.equal(this.underlying);
          expect(event.args.platformReward).to.be.bignumber.equal(resultingPlatformReward);
          expect(event.args.poolReward).to.be.bignumber.equal(resultingPoolReward);
        });
  
        it('emits Invocation event', async function () {
          const event = this.logs[0];
  
          expect(event.args.invokeTo).to.be.equal(this.invokable.address);
          expect(event.args.invokeValue).to.be.bignumber.equal(testPayableAmount);
          expect(event.args.invokeValue).to.be.bignumber.equal(new BN(15));
          expect(event.args.underlyingAmount).to.be.bignumber.equal(underlyingAmount);
        });
  
        it('emits HelperDump event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, TestInvokable, 'HelperDump', {
            currentTokenAddress: this.underlying,
            isCurrentTokenEther: true
          });
  
          expect(event.args.currentTokenAmount).to.be.bignumber.equal(underlyingAmount);
          expect(event.args.currentRepaymentAmount).to.be.bignumber.equal(underlyingBalanceRepayAmount);
        });
  
        it('increments kEther vault balance', async function () {
          expect(await balance.current(invokerVaultAddress)).to.be.bignumber.equal(this.invokerVaultStartingBalance.addn(10));
        });
      });
  
      describe('when borrow multi-pool with successful repay', function () {
        const underlyingAmount = kEtherUnderlyingBalance.muln(2);
        const underlyingBalanceRepayAmount = new BN(100300).muln(2);
        const underlyingBalanceWithReward = new BN(100200 + 40 + 40);
        const resultingPlatformReward = new BN(20);
        const resultingPoolReward = new BN(80);
  
        beforeEach('invoking', async function () {
          this.invokerVaultStartingBalance = await balance.current(invokerVaultAddress);
          const invokeTo = this.invokable.address;
          const receipt = await this.invoker.invoke(invokeTo, [], ETHER_TOKEN_ADDRESS, underlyingAmount);
          this.logs = receipt.logs;
          this.txHash = receipt.tx;
          this.underlying = await this.kEther.underlying();
        });
  
        it('increments native totalReserve', async function () {
          expect(await this.kEther.totalReserve()).to.be.bignumber.equal(underlyingBalanceWithReward);
        });
  
        it('emits Reward event', async function () {
          const event = this.logs[this.logs.length - 1];
  
          expect(event.args.tokenAddress).to.be.equal(this.underlying);
          expect(event.args.platformReward).to.be.bignumber.equal(resultingPlatformReward);
          expect(event.args.poolReward).to.be.bignumber.equal(resultingPoolReward);
        });
  
        it('emits Invocation event', async function () {
          const event = this.logs[0];
  
          expect(event.args.invokeTo).to.be.equal(this.invokable.address);
          expect(event.args.invokeValue).to.be.bignumber.equal(new BN(0));
          expect(event.args.underlyingAmount).to.be.bignumber.equal(underlyingAmount);
        });
  
        it('emits HelperDump event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, TestInvokable, 'HelperDump', {
            currentTokenAddress: this.underlying,
            isCurrentTokenEther: true
          });
  
          expect(event.args.currentTokenAmount).to.be.bignumber.equal(underlyingAmount);
          expect(event.args.currentRepaymentAmount).to.be.bignumber.equal(underlyingBalanceRepayAmount);
        });
  
        it('increments kEther vault balance', async function () {
          expect(await balance.current(invokerVaultAddress)).to.be.bignumber.equal(this.invokerVaultStartingBalance.addn(20));
        });
      });
  
      describe('when borrow whole fund with too high repay', function () {
        const totalRepaymentAmount = new BN(100300);
        const tooMuch = totalRepaymentAmount.addn(1).toString();
  
        it('reverts', async function () {
          const invokeData = encodeExecute(1, ["uint256"], [tooMuch]);
          const invokeAddress = this.invokable.address;
          await expectRevert(
            this.invoker.invoke(invokeAddress, invokeData, ETHER_TOKEN_ADDRESS, kEtherUnderlyingBalance),
            "Invoker: incorrect repayment amount");
        });
      });
  
      describe('when borrow whole fund with too low repay', function () {
        const totalRepaymentAmount = new BN(100300);
        const tooLittle = totalRepaymentAmount.subn(1).toString();
  
        it('reverts', async function () {
          const invokeData = encodeExecute(1, ["uint256"], [tooLittle]);
          const invokeAddress = this.invokable.address;
          await expectRevert(
            this.invoker.invoke(invokeAddress, invokeData, ETHER_TOKEN_ADDRESS, kEtherUnderlyingBalance),
            "Invoker: incorrect repayment amount");
        });
      });

      describe('when borrow non-supported token', function () {
        const underlyingAmount = kEtherUnderlyingBalance;

        it('reverts', async function () {
          const invokeTo = this.invokable.address;
          const invokeData = await this.invokable.contract.methods.execute("0x").encodeABI();
          await expectRevert(
            this.invoker.invoke(invokeTo, invokeData, OTHER_TOKEN_ADDRESS, underlyingAmount),
            "Invoker: no liquidity for token");
        });
      });

      /*
       * VIEWS
       */

      describe('when calling totalLiquidity', function () {
        it('returns liquidity for registered token', async function () {
          expect(await this.invoker.totalLiquidity(ETHER_TOKEN_ADDRESS)).to.be.bignumber.equal(kEtherUnderlyingBalance.muln(2));
        });

        it('returns 0 for nonregistered token', async function () {
          expect(await this.invoker.totalLiquidity(OTHER_TOKEN_ADDRESS)).to.be.bignumber.equal(new BN(0));
        });
      });

      describe('when calling estimateRepaymentAmount', function () {
        it('returns correct amount for single pool', async function () {
          expect(await this.invoker.estimateRepaymentAmount(ETHER_TOKEN_ADDRESS, kEtherUnderlyingBalance))
            .to.be.bignumber.equal(new BN(100300));
        });

        it('returns correct amount for multi pool', async function () {
          expect(await this.invoker.estimateRepaymentAmount(ETHER_TOKEN_ADDRESS, kEtherUnderlyingBalance.muln(2)))
            .to.be.bignumber.equal(new BN(200600));
        });

        it('reverts for too high amount', async function () {
          await expectRevert(this.invoker.estimateRepaymentAmount(ETHER_TOKEN_ADDRESS, kEtherUnderlyingBalance.muln(3)),
            "Invoker: not enough liquidity");
        });

        it('reverts for nonregistered token', async function () {
          await expectRevert(this.invoker.estimateRepaymentAmount(OTHER_TOKEN_ADDRESS, new BN(0)),
            "Invoker: no liquidity for token");
        });
      });

      /*
       * ADMIN TESTS
       */
  
      describe('when setPlatformReward but not admin', function () {
        it('reverts', async function () {
          await expectRevert(
            this.invoker.setPlatformReward(new BN(1), {from: userAddress}),
            "Ownable: caller is not the owner");
        });
      });
  
      describe('when setPoolReward but not admin', function () {
        it('reverts', async function () {
          await expectRevert(
            this.invoker.setPoolReward(new BN(4), {from: userAddress}),
            "Ownable: caller is not the owner");
        });
      });

      describe('when setPoolRewardAddress but not admin', function () {
        it('reverts', async function () {
          await expectRevert(
            this.invoker.setPoolRewardAddress(ETHER_TOKEN_ADDRESS, this.kEther.address, {from: userAddress}),
            "Ownable: caller is not the owner");
        });
      });
  
      describe('when setPlatformVaultAddress but not admin', function () {
        it('reverts', async function () {
          await expectRevert(
            this.invoker.setPlatformVaultAddress(invokerVaultAddress, {from: userAddress}),
            "Ownable: caller is not the owner");
        });
      });
  
      /*
       *  RECURSIVE CALL TESTS
       */
      describe('when invoker invokes invoker', function () {
        it('reverts', async function () {
          const invokeData = await this.invoker.contract.methods
            .invoke(this.invokable.address, "0x", ETHER_TOKEN_ADDRESS, kEtherUnderlyingBalance.toString(10))
            .encodeABI();
  
          await expectRevert(
            this.invoker.invoke(this.invoker.address, invokeData, ETHER_TOKEN_ADDRESS, kEtherUnderlyingBalance),
            "Invoker: cannot invoke this contract");
        });
      });
  
      describe('when invokable invokes invoker.invoke()', function () {
        it('reverts', async function () {
          // (A) Invoker: invoke -> invokable fallback(), send whole kEther pool
          const invokableRunInvokeData = await this.invoker.contract.methods
            .invoke(this.invokable.address, "0x", ETHER_TOKEN_ADDRESS, kEtherUnderlyingBalance.toString(10))
            .encodeABI();
  
          // (B) Invokable: invoke -> (A)
          const invokeData = encodeExecute(3, ["address", "bytes"], [this.invoker.address, invokableRunInvokeData]);

          // (C) Invoker: invoke -> (B), send whole kEther pool
          const invoke = this.invoker.invoke(this.invokable.address, invokeData, ETHER_TOKEN_ADDRESS, kEtherUnderlyingBalance);
  
          await expectRevert(invoke, "Invoker: not fresh environment");
        });
      });
    });
  });

  describe('for ERC20 borrows', function () {
    const [ ownerAddress, userAddress, kErc20VaultAddress, invokerVaultAddress ] = accounts;
    const erc20Balance = new BN(10).pow(new BN(20)); // 100 TT
    const noopInvokerBalance = new BN(10000);
    const kErc20UnderlyingBalance = new BN(100000);
  
    beforeEach(async function () {
      this.erc20 = await TestToken.new("Test Token", "TT", 18, {from: ownerAddress});
      this.kErc20 = await KErc20.new(this.erc20.address, "Kollateral TT", "kTT", 18, {from: ownerAddress});

      await this.kErc20.setPlatformReward(5, {from: ownerAddress});
      await this.kErc20.setPoolReward(20, {from: ownerAddress});
      await this.kErc20.setPlatformVaultAddress(kErc20VaultAddress, {from: ownerAddress});
  
      this.proxy = await KollateralLiquidityProxy.new({from: ownerAddress});
      await this.proxy.registerPool(this.erc20.address, this.kErc20.address, {from: ownerAddress});
  
      this.kErc202 = await KErc20.new(this.erc20.address, "Kollateral2 TT", "kTT", 18, {from: ownerAddress});
      
      await this.kErc202.setPlatformReward(5, {from: ownerAddress});
      await this.kErc202.setPoolReward(20, {from: ownerAddress});
      await this.kErc202.setPlatformVaultAddress(kErc20VaultAddress, {from: ownerAddress});
  
      this.proxy2 = await KollateralLiquidityProxy.new({from: ownerAddress});
      await this.proxy2.registerPool(this.erc20.address, this.kErc202.address, {from: ownerAddress});
  
      this.invoker = await Invoker.new({from: ownerAddress});
      await this.invoker.setLiquidityProxies(this.erc20.address, [this.proxy.address, this.proxy2.address], {from: ownerAddress});
      await this.invoker.setPlatformReward(1, {from: ownerAddress});
      await this.invoker.setPoolReward(4, {from: ownerAddress});
      await this.invoker.setPoolRewardAddress(this.erc20.address, this.kErc20.address, {from: ownerAddress});
      await this.invoker.setPlatformVaultAddress(invokerVaultAddress, {from: ownerAddress});
  
      this.invokable = await TestInvokable.new({from: ownerAddress});
      await this.erc20.mint(noopInvokerBalance.toString());
      await this.erc20.transfer(this.invokable.address, noopInvokerBalance.toString());

      await this.erc20.mint(kErc20UnderlyingBalance.muln(2));
      await this.erc20.approve(this.kErc20.address, kErc20UnderlyingBalance);
      await this.kErc20.mint(kErc20UnderlyingBalance);
      await this.erc20.approve(this.kErc202.address, kErc20UnderlyingBalance);
      await this.kErc202.mint(kErc20UnderlyingBalance);

      await this.erc20.mint(erc20Balance.toString());
    });
  
    describe('invoke', function () {
      describe('when borrow single pool with successful repay', function () {
        const underlyingAmount = kErc20UnderlyingBalance;
        const underlyingBalanceRepayAmount = new BN(100300);
        const underlyingBalanceWithReward = new BN(100240);
        const resultingPlatformReward = new BN(10);
        const resultingPoolReward = new BN(40);
  
        beforeEach('invoking', async function () {
          this.invokerVaultStartingBalance = await this.erc20.balanceOf(invokerVaultAddress);
          const invokeTo = this.invokable.address;
          const receipt = await this.invoker.invoke(invokeTo, [], this.erc20.address, underlyingAmount);
          this.logs = receipt.logs;
          this.txHash = receipt.tx;
          this.underlying = await this.kErc20.underlying();
        });
  
        it('increments native totalReserve', async function () {
          expect(await this.kErc20.totalReserve()).to.be.bignumber.equal(underlyingBalanceWithReward);
        });
  
        it('emits Reward event', async function () {
          const event = this.logs[this.logs.length - 1];
  
          expect(event.args.tokenAddress).to.be.equal(this.underlying);
          expect(event.args.platformReward).to.be.bignumber.equal(resultingPlatformReward);
          expect(event.args.poolReward).to.be.bignumber.equal(resultingPoolReward);
        });
  
        it('emits Invocation event', async function () {
          const event = this.logs[0];
  
          expect(event.args.invokeTo).to.be.equal(this.invokable.address);
          expect(event.args.invokeValue).to.be.bignumber.equal(new BN(0));
          expect(event.args.underlyingAmount).to.be.bignumber.equal(underlyingAmount);
        });
  
        it('emits HelperDump event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, TestInvokable, 'HelperDump', {
            currentTokenAddress: this.underlying,
            isCurrentTokenEther: false
          });
  
          expect(event.args.currentTokenAmount).to.be.bignumber.equal(underlyingAmount);
          expect(event.args.currentRepaymentAmount).to.be.bignumber.equal(underlyingBalanceRepayAmount);
        });
  
        it('increments kErc20 vault balance', async function () {
          expect(await this.erc20.balanceOf(invokerVaultAddress)).to.be.bignumber.equal(this.invokerVaultStartingBalance.addn(10));
        });
      });
  
      describe('when forward payable with successful repay', function () {
        const underlyingAmount = kErc20UnderlyingBalance;
        const underlyingBalanceRepayAmount = new BN(100300);
        const underlyingBalanceWithReward = new BN(100240);
        const resultingPlatformReward = new BN(10);
        const resultingPoolReward = new BN(40);
        const testPayableAmount = new BN(15);
  
        beforeEach('invoking', async function () {
          this.invokerVaultStartingBalance = await this.erc20.balanceOf(invokerVaultAddress);
          const invokeTo = this.invokable.address;
          const invokeData = encodeExecute(4, ["uint256"], [testPayableAmount.toString()]);
          const receipt = await this.invoker.invoke(invokeTo, invokeData, this.erc20.address, underlyingAmount, {value: testPayableAmount});
          this.logs = receipt.logs;
          this.txHash = receipt.tx;
          this.underlying = await this.kErc20.underlying();
        });
  
        it('increments native totalReserve', async function () {
          expect(await this.kErc20.totalReserve()).to.be.bignumber.equal(underlyingBalanceWithReward);
        });
  
        it('emits Reward event', async function () {
          const event = this.logs[this.logs.length - 1];
  
          expect(event.args.tokenAddress).to.be.equal(this.underlying);
          expect(event.args.platformReward).to.be.bignumber.equal(resultingPlatformReward);
          expect(event.args.poolReward).to.be.bignumber.equal(resultingPoolReward);
        });
  
        it('emits Invocation event', async function () {
          const event = this.logs[0];
  
          expect(event.args.invokeTo).to.be.equal(this.invokable.address);
          expect(event.args.invokeValue).to.be.bignumber.equal(testPayableAmount);
          expect(event.args.invokeValue).to.be.bignumber.equal(new BN(15));
          expect(event.args.underlyingAmount).to.be.bignumber.equal(underlyingAmount);
        });
  
        it('emits HelperDump event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, TestInvokable, 'HelperDump', {
            currentTokenAddress: this.underlying,
            isCurrentTokenEther: false
          });
  
          expect(event.args.currentTokenAmount).to.be.bignumber.equal(underlyingAmount);
          expect(event.args.currentRepaymentAmount).to.be.bignumber.equal(underlyingBalanceRepayAmount);
        });
  
        it('increments kErc20 vault balance', async function () {
          expect(await this.erc20.balanceOf(invokerVaultAddress)).to.be.bignumber.equal(this.invokerVaultStartingBalance.addn(10));
        });
      });
  
      describe('when borrow multi-pool with successful repay', function () {
        const underlyingAmount = kErc20UnderlyingBalance.muln(2);
        const underlyingBalanceRepayAmount = new BN(100300).muln(2);
        const underlyingBalanceWithReward = new BN(100200 + 40 + 40);
        const resultingPlatformReward = new BN(20);
        const resultingPoolReward = new BN(80);
  
        beforeEach('invoking', async function () {
          this.invokerVaultStartingBalance = await this.erc20.balanceOf(invokerVaultAddress);
          const invokeTo = this.invokable.address;
          const receipt = await this.invoker.invoke(invokeTo, [], this.erc20.address, underlyingAmount);
          this.logs = receipt.logs;
          this.txHash = receipt.tx;
          this.underlying = await this.kErc20.underlying();
        });
  
        it('increments native totalReserve', async function () {
          expect(await this.kErc20.totalReserve()).to.be.bignumber.equal(underlyingBalanceWithReward);
        });
  
        it('emits Reward event', async function () {
          const event = this.logs[this.logs.length - 1];
  
          expect(event.args.tokenAddress).to.be.equal(this.underlying);
          expect(event.args.platformReward).to.be.bignumber.equal(resultingPlatformReward);
          expect(event.args.poolReward).to.be.bignumber.equal(resultingPoolReward);
        });
  
        it('emits Invocation event', async function () {
          const event = this.logs[0];
  
          expect(event.args.invokeTo).to.be.equal(this.invokable.address);
          expect(event.args.invokeValue).to.be.bignumber.equal(new BN(0));
          expect(event.args.underlyingAmount).to.be.bignumber.equal(underlyingAmount);
        });
  
        it('emits HelperDump event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, TestInvokable, 'HelperDump', {
            currentTokenAddress: this.underlying,
            isCurrentTokenEther: false
          });
  
          expect(event.args.currentTokenAmount).to.be.bignumber.equal(underlyingAmount);
          expect(event.args.currentRepaymentAmount).to.be.bignumber.equal(underlyingBalanceRepayAmount);
        });
  
        it('increments kErc20 vault balance', async function () {
          expect(await this.erc20.balanceOf(invokerVaultAddress)).to.be.bignumber.equal(this.invokerVaultStartingBalance.addn(20));
        });
      });
  
      describe('when borrow whole fund with too high repay', function () {
        const totalRepaymentAmount = new BN(100300);
        const tooMuch = totalRepaymentAmount.addn(1).toString();
  
        it('reverts', async function () {
          const invokeData = encodeExecute(1, ["uint256"], [tooMuch.toString()]);
          const invokeAddress = this.invokable.address;
          await expectRevert(
            this.invoker.invoke(invokeAddress, invokeData, this.erc20.address, kErc20UnderlyingBalance),
            "Invoker: incorrect repayment amount");
        });
      });
  
      describe('when borrow whole fund with too low repay', function () {
        const totalRepaymentAmount = new BN(100300);
        const tooLittle = totalRepaymentAmount.subn(1).toString();
  
        it('reverts', async function () {
          const invokeData = encodeExecute(1, ["uint256"], [tooLittle.toString()]);
          const invokeAddress = this.invokable.address;
          await expectRevert(
            this.invoker.invoke(invokeAddress, invokeData, this.erc20.address, kErc20UnderlyingBalance),
            "Invoker: incorrect repayment amount");
        });
      });

      describe('when borrow non-supported token', function () {
        const underlyingAmount = kErc20UnderlyingBalance;

        it('reverts', async function () {
          const invokeTo = this.invokable.address;
          const invokeData = await this.invokable.contract.methods.execute("0x").encodeABI();
          await expectRevert(
            this.invoker.invoke(invokeTo, invokeData, OTHER_TOKEN_ADDRESS, underlyingAmount),
            "Invoker: no liquidity for token");
        });
      });

      /*
       * VIEWS
       */

      describe('when calling totalLiquidity', function () {
        it('returns liquidity for registered token', async function () {
          expect(await this.invoker.totalLiquidity(this.erc20.address)).to.be.bignumber.equal(kErc20UnderlyingBalance.muln(2));
        });

        it('returns 0 for nonregistered token', async function () {
          expect(await this.invoker.totalLiquidity(OTHER_TOKEN_ADDRESS)).to.be.bignumber.equal(new BN(0));
        });
      });

      /*
       *  RECURSIVE CALL TESTS
       */
      describe('when invoker invokes invoker', function () {
        it('reverts', async function () {
          const invokeData = await this.invoker.contract.methods
            .invoke(this.invokable.address, "0x", this.erc20.address, kErc20UnderlyingBalance.toString(10))
            .encodeABI();
  
          await expectRevert(
            this.invoker.invoke(this.invoker.address, invokeData, this.erc20.address, kErc20UnderlyingBalance),
            "Invoker: cannot invoke this contract");
        });
      });
  
      describe('when invokable invokes invoker.invoke()', function () {
        it('reverts', async function () {
          // (A) Invoker: invoke -> invokable fallback(), send whole kErc20 pool
          const invokableRunInvokeData = await this.invoker.contract.methods
            .invoke(this.invokable.address, "0x", this.erc20.address, kErc20UnderlyingBalance.toString(10))
            .encodeABI();
  
          // (B) Invokable: invoke -> (A)
          const invokeData = encodeExecute(3, ["address", "bytes"], [this.invoker.address, invokableRunInvokeData]);
  
          // (C) Invoker: invoke -> (B), send whole kErc20 pool
          const invoke = this.invoker.invoke(this.invokable.address, invokeData, this.erc20.address, kErc20UnderlyingBalance);
  
          await expectRevert(invoke, "Invoker: not fresh environment");
        });
      });
    });
  });
});