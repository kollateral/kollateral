import { run, ethers } from "@nomiclabs/buidler";

async function main() {
    await run("compile");

    const accounts = await ethers.getSigners();

    console.log("Accounts:", accounts);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });