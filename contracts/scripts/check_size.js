const fs = require("fs");
const path = require("path");

async function main() {
  const contractsDir = path.join(__dirname, "../artifacts-pvm/contracts");

  // Helper to verify directory exists
  if (!fs.existsSync(contractsDir)) {
    console.log(
      `Artifacts directory not found at ${contractsDir}. Please run 'npx hardhat compile' first.`
    );
    return;
  }

  const contracts = [
    { name: "VPToken", file: "VPToken.sol" },
    { name: "VPTokenLite", file: "VPTokenLite.sol" },
    { name: "MurmurNFT", file: "MurmurNFT.sol" },
    { name: "MurmurNFTLite", file: "MurmurNFTLite.sol" },
    { name: "MurmurProtocol", file: "MurmurProtocol.sol" },
    { name: "VDOTToken", file: "VDOTToken.sol" },
  ];

  console.log("Contract Size Check:");
  console.log("---------------------");

  for (const c of contracts) {
    const artifactPath = path.join(contractsDir, c.file, `${c.name}.json`);
    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
      const bytecode = artifact.deployedBytecode;
      if (bytecode && bytecode !== "0x") {
        const size = (bytecode.length - 2) / 2;
        const sizeInKb = (size / 1024).toFixed(3);
        console.log(`${c.name}: ${size} bytes (${sizeInKb} KB)`);
        if (size > 24576) {
          console.log(`  ⚠️ WARN: Exceeds Spurious Dragon limit (24KB)`);
        }
      } else {
        console.log(`${c.name}: No bytecode found (interface or abstract?)`);
      }
    } else {
      console.log(`${c.name}: Artifact not found at ${artifactPath}`);
    }
  }
}

main();
