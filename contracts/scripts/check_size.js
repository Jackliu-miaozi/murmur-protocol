const fs = require("fs");
const path = require("path");

async function main() {
  const contractsDir = path.join(__dirname, "../artifacts-pvm/contracts");

  if (!fs.existsSync(contractsDir)) {
    console.log(
      `Artifacts directory not found. Please run 'npx hardhat compile' first.`
    );
    return;
  }

  const contracts = [
    // Core
    { name: "RouterProxy", file: "core/RouterProxy.sol" },
    { name: "MurmurProtocol", file: "core/MurmurProtocol.sol" },
    { name: "VDOTToken", file: "core/VDOTToken.sol" },

    // VP Modules
    { name: "VPStaking", file: "modules/vp/VPStaking.sol" },
    { name: "VPWithdraw", file: "modules/vp/VPWithdraw.sol" },
    { name: "VPSettlement", file: "modules/vp/VPSettlement.sol" },
    { name: "VPAdmin", file: "modules/vp/VPAdmin.sol" },

    // NFT Modules
    { name: "NFTMint", file: "modules/nft/NFTMint.sol" },
    { name: "NFTQuery", file: "modules/nft/NFTQuery.sol" },
    { name: "NFTAdmin", file: "modules/nft/NFTAdmin.sol" },
  ];

  console.log("Contract Size Check (Router Proxy Pattern):");
  console.log("============================================\n");

  let total = 0;
  let allUnder24KB = true;

  for (const c of contracts) {
    const artifactPath = path.join(contractsDir, c.file, `${c.name}.json`);
    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
      const bytecode = artifact.deployedBytecode;
      if (bytecode && bytecode !== "0x") {
        const size = (bytecode.length - 2) / 2;
        const sizeInKb = (size / 1024).toFixed(2);
        const status = size > 24576 ? "⚠️" : "✅";
        if (size > 24576) allUnder24KB = false;
        console.log(
          `${status} ${c.name.padEnd(20)} ${sizeInKb.padStart(8)} KB`
        );
        total += size;
      }
    } else {
      console.log(`❌ ${c.name}: Not found`);
    }
  }

  console.log("\n============================================");
  console.log(`Total: ${(total / 1024).toFixed(2)} KB`);
  console.log(
    `Status: ${
      allUnder24KB
        ? "✅ All contracts < 24KB!"
        : "⚠️ Some contracts exceed 24KB"
    }`
  );
}

main();
