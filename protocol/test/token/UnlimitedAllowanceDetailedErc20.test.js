const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const TestToken = contract.fromArtifact('TestToken');

const MAX_UINT256 = new BN(2).pow(new BN(256)).subn(1);

describe('UnlimitedAllowanceDetailedErc20', function () {
  const [ ownerAddress, userAddress ] = accounts;

  beforeEach(async function () {
    this.erc20 = await TestToken.new("Test Token", "TT", 18, {from: ownerAddress});
  });

  describe('transferFrom', function () {
    const amount = new BN(1000);

    beforeEach('transferFrom', async function () {
      await this.erc20.mint(amount, {from: ownerAddress});
    });

    describe('when amount equals approved', function () {
      beforeEach('transferFrom', async function () {
        await this.erc20.approve(userAddress, amount, {from: ownerAddress});
        const { logs } = await this.erc20.transferFrom(ownerAddress, userAddress, amount, {from: userAddress});
        this.logs = logs;
      });

      it('decrements allowance', async function () {
        const allowance = await this.erc20.allowance(ownerAddress, userAddress);
        expect(allowance).to.be.bignumber.equal(new BN(0));
      });

      it('emits Transfer event', async function () {
        const event = expectEvent.inLogs(this.logs, 'Transfer', {
          from: ownerAddress,
          to: userAddress,
        });
        expect(event.args.value).to.be.bignumber.equal(amount);
      });
    });

    describe('when amount exceeds approved', function () {
      beforeEach('transferFrom', async function () {
        await this.erc20.approve(userAddress, amount, {from: ownerAddress});
      });

      it('emits Transfer event', async function () {
        await expectRevert(
          this.erc20.transferFrom(ownerAddress, userAddress, amount.addn(1), {from: userAddress}),
          "ERC20: transfer amount exceeds balance");
      });
    });

    describe('when approved max', function () {
      beforeEach('transferFrom', async function () {
        await this.erc20.approve(userAddress, MAX_UINT256, {from: ownerAddress});
        const { logs } = await this.erc20.transferFrom(ownerAddress, userAddress, amount, {from: userAddress});
        this.logs = logs;
      });

      it('doesnt decrement allowance', async function () {
        const allowance = await this.erc20.allowance(ownerAddress, userAddress);
        expect(allowance).to.be.bignumber.equal(MAX_UINT256);
      });

      it('emits Transfer event', async function () {
        const event = expectEvent.inLogs(this.logs, 'Transfer', {
          from: ownerAddress,
          to: userAddress,
        });
        expect(event.args.value).to.be.bignumber.equal(amount);
      });
    });
  });
});