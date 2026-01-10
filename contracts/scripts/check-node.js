const hre = require("hardhat");

/**
 * Check if Polkadot VM node is running and accessible
 */
async function main() {
  console.log("🔍 Checking Polkadot VM node status...\n");

  try {
    // Try to get network info
    const network = await hre.ethers.provider.getNetwork();
    console.log("✅ Network connected:");
    console.log(`   Chain ID: ${network.chainId}`);
    console.log(`   Name: ${network.name}`);

    // Try to get block number
    const blockNumber = await hre.ethers.provider.getBlockNumber();
    console.log(`   Current block: ${blockNumber}`);

    // Try to get signers
    const signers = await hre.ethers.getSigners();
    console.log(`   Available signers: ${signers.length}`);

    if (signers.length > 0) {
      const balance = await hre.ethers.provider.getBalance(signers[0].address);
      console.log(`   Deployer balance: ${hre.ethers.formatEther(balance)} ETH`);
    }

    // Try a simple contract deployment test
    console.log("\n🧪 Testing contract deployment...");
    const TestContract = await hre.ethers.getContractFactory("VDOTToken");
    const testContract = await TestContract.deploy(signers[0].address);
    await testContract.waitForDeployment();
    const address = await testContract.getAddress();
    console.log(`✅ Test contract deployed successfully at: ${address}`);

    console.log("\n✅ Node is running and ready for testing!");
    console.log("   You can now run: npm test");

  } catch (error) {
    console.error("\n❌ Node check failed:");
    console.error(`   Error: ${error.message}\n`);

    if (error.message.includes("Transaction is temporarily banned")) {
      console.log("💡 Solution:");
      console.log("   1. Make sure bin/revive-dev-node and bin/eth-rpc exist");
      console.log("   2. Start the node: ./bin/revive-dev-node --dev");
      console.log("   3. Start the adapter: ./bin/eth-rpc --dev");
      console.log("   4. Or use standard network: npx hardhat test --network hardhatStandard");
    } else if (error.message.includes("ECONNREFUSED") || error.message.includes("connect")) {
      console.log("💡 Solution:");
      console.log("   The node is not running. Please start it first.");
      console.log("   See TEST_SETUP.md for detailed instructions.");
    } else {
      console.log("💡 Check TEST_SETUP.md for troubleshooting steps.");
    }

    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
