const fs = require("fs");
const path = require("path");

/**
 * 检查合约字节码大小
 * 直接运行: node scripts/check-contract-size.js
 */
function main() {
  const artifactsDir = path.join(__dirname, "../artifacts-pvm/contracts");
  
  if (!fs.existsSync(artifactsDir)) {
    console.log("❌ Artifacts directory not found. Please compile first:");
    console.log("   npx hardhat compile");
    return;
  }

  const contracts = [
    "VPToken.sol",
    "TopicFactory.sol",
    "TopicVault.sol",
    "AIScoreVerifier.sol",
    "MessageRegistry.sol",
    "CurationModule.sol",
    "NFTMinter.sol",
    "DeploymentHelper.sol"
  ];

  console.log("📊 Contract Bytecode Size Report\n");
  console.log("─".repeat(60));
  console.log("Contract Name".padEnd(25) + "Bytecode Size".padEnd(20) + "Status");
  console.log("─".repeat(60));

  const limit = 24576; // 24KB limit for Polkadot EVM
  let totalSize = 0;

  for (const contract of contracts) {
    const contractName = contract.replace(".sol", "");
    const artifactPath = path.join(artifactsDir, contract, `${contractName}.json`);
    
    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
      const bytecode = artifact.bytecode;
      const size = bytecode ? (bytecode.length - 2) / 2 : 0; // Remove '0x' prefix and divide by 2
      totalSize += size;
      
      const status = size > limit ? "❌ TOO BIG" : size > limit * 0.8 ? "⚠️  WARNING" : "✅ OK";
      const sizeKB = (size / 1024).toFixed(2);
      
      console.log(
        contractName.padEnd(25) + 
        `${sizeKB} KB (${size} bytes)`.padEnd(20) + 
        status
      );
    } else {
      console.log(contractName.padEnd(25) + "NOT FOUND".padEnd(20) + "❌");
    }
  }

  console.log("─".repeat(60));
  console.log(`Total: ${(totalSize / 1024).toFixed(2)} KB (${totalSize} bytes)`);
  console.log(`Limit: ${(limit / 1024).toFixed(2)} KB (${limit} bytes)`);
  console.log("─".repeat(60));

  if (totalSize > limit) {
    console.log("\n⚠️  Some contracts exceed the size limit!");
    console.log("\n💡 Solutions:");
    console.log("   1. Make sure you've recompiled with optimizer enabled:");
    console.log("      rm -rf artifacts-pvm cache-pvm");
    console.log("      npx hardhat compile");
    console.log("   2. If still too big, consider:");
    console.log("      - Using proxy patterns");
    console.log("      - Splitting contracts into smaller modules");
    console.log("      - Removing unused code");
  }
}

main();
