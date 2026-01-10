const hre = require("hardhat");

/**
 * 部署 vDOT Token 合约
 * 
 * 这个脚本用于部署一个简单的 ERC-20 vDOT 代币，用于测试 Murmur Protocol
 * 
 * 使用方法:
 *   npx hardhat run scripts/deploy-vdot.js --network <network>
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying VDOTToken with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  console.log("\n=== Deploying VDOTToken ===\n");

  // Deploy VDOTToken
  console.log("Deploying VDOTToken...");
  const VDOTToken = await hre.ethers.getContractFactory("VDOTToken");
  const vdotToken = await VDOTToken.deploy(deployer.address);
  await vdotToken.waitForDeployment();
  
  const vdotTokenAddress = await vdotToken.getAddress();
  
  console.log("✅ VDOTToken deployed to:", vdotTokenAddress);
  console.log("   Token name:", await vdotToken.name());
  console.log("   Token symbol:", await vdotToken.symbol());
  console.log("   Total supply:", (await vdotToken.totalSupply()).toString());
  console.log("   Deployer balance:", (await vdotToken.balanceOf(deployer.address)).toString());

  console.log("\n" + "=".repeat(60));
  console.log("🎉 VDOTToken Deployment Complete!");
  console.log("=".repeat(60));
  console.log("\n📝 Save this address for Murmur Protocol deployment:");
  console.log("   export VDOT_TOKEN=" + vdotTokenAddress);
  console.log("\n💡 You can now use this address when deploying Murmur Protocol contracts\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
