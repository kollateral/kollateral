// @ts-ignore
import { ethers } from "@nomiclabs/buidler";
import { Signer } from "ethers";

describe("Token", function() {
  let accounts: Signer[];

  beforeEach(async function() {
    accounts = await ethers.getSigners();
  });

  it("should do something right", async function() {
    // Do something with the accounts
    for (let account of accounts) {
      // console.log(await account.getAddress());
    }
  });
});
