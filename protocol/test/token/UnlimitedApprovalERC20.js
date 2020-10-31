const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("UnlimitedApprovalERC20", function() {
  let ownerAddress;
  let userAddress;

  let TestToken;

  before(async function () {
    const [owner, user] = await ethers.getSigners();
    ownerAddress = owner.address;
    userAddress = user.address;
  });

  beforeEach(async function () {
    const TestTokenFactory = await ethers.getContractFactory("TestToken");
    TestToken = await TestTokenFactory.deploy("Test Token", "TT");
  });

  describe('transferFrom', function () {
    const amount = ethers.BigNumber.from(1000);

    beforeEach('transferFrom', async function () {
      await TestToken.mint(amount);
    });

    describe('when amount equals approved', function () {

      beforeEach('transferFrom', async function () {
        await TestToken.approve(userAddress, amount);
        await TestToken.transferFrom(ownerAddress, userAddress, amount);
      });

      it('decrements allowance', async function () {
        const allowance = await TestToken.allowance(ownerAddress, userAddress);
        expect(allowance).to.equal(ethers.BigNumber.from(0));
      });

      it('emits Transfer event', async function () {
        const xferLog = TestToken.filters.Transfer(ownerAddress, userAddress);
        expect(xferLog).not.to.be.null;
      });
    });

  //describe('when amount exceeds approved', function () {
  //...
  });
});
