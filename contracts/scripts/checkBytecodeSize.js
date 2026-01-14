const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// EIP-170: Contract code size limit is 24576 bytes (24 KB)
const MAX_BYTECODE_SIZE = 24576;

/**
 * Calculate bytecode size in bytes
 * @param {string} bytecode - The bytecode string (with or without 0x prefix)
 * @returns {number} Size in bytes
 */
function getBytecodeSize(bytecode) {
  if (!bytecode || bytecode === "0x") {
    return 0;
  }
  // Remove 0x prefix if present, then divide by 2 (each byte is 2 hex chars)
  const cleanBytecode = bytecode.startsWith("0x") ? bytecode.slice(2) : bytecode;
  return cleanBytecode.length / 2;
}

/**
 * Get all contract artifacts using Hardhat's API
 * @returns {Array} Array of fully qualified contract names
 */
async function getAllContractNames() {
  try {
    // Use Hardhat's built-in method to get all contract names
    const fullyQualifiedNames = await hre.artifacts.getAllFullyQualifiedNames();
    return fullyQualifiedNames;
  } catch (error) {
    // Fallback: manually scan artifacts directory
    console.log("⚠️  Using fallback method to find contracts...");
    const artifactsDir = path.join(__dirname, "../artifacts/contracts");
    const contracts = new Set();

    function scanDirectory(dir, prefix = "") {
      if (!fs.existsSync(dir)) {
        return;
      }

      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          scanDirectory(fullPath, relativePath);
        } else if (entry.name.endsWith(".json")) {
          try {
            const artifactContent = fs.readFileSync(fullPath, "utf8");
            const artifact = JSON.parse(artifactContent);
            
            if (artifact.contractName && artifact.bytecode && artifact.bytecode !== "0x") {
              const contractName = prefix 
                ? `${prefix.replace(".sol", "")}/${artifact.contractName}`
                : artifact.contractName;
              contracts.add(contractName);
            }
          } catch (error) {
            continue;
          }
        }
      }
    }

    scanDirectory(artifactsDir);
    return Array.from(contracts);
  }
}

/**
 * Check bytecode size for a single contract
 * @param {string} contractName - Name of the contract
 * @returns {Object} Contract size information
 */
function checkContractSize(contractName) {
  try {
    const artifact = hre.artifacts.readArtifactSync(contractName);
    const bytecode = artifact.bytecode;
    const deployedBytecode = artifact.deployedBytecode;

    const bytecodeSize = getBytecodeSize(bytecode);
    const deployedBytecodeSize = getBytecodeSize(deployedBytecode);

    return {
      name: contractName,
      bytecodeSize,
      deployedBytecodeSize,
      exceedsLimit: deployedBytecodeSize > MAX_BYTECODE_SIZE,
      error: null,
    };
  } catch (error) {
    return {
      name: contractName,
      bytecodeSize: 0,
      deployedBytecodeSize: 0,
      exceedsLimit: false,
      error: error.message,
    };
  }
}

/**
 * Main function to check all contract bytecode sizes
 */
async function checkAllContractSizes() {
  console.log("🔍 Checking contract bytecode sizes...\n");
  console.log("=".repeat(80));

  // First, ensure contracts are compiled
  console.log("📦 Compiling contracts...\n");
  try {
    await hre.run("compile", { quiet: true });
  } catch (error) {
    console.error("❌ Compilation failed:", error.message);
    process.exit(1);
  }

  // Get all contract names
  const contractNames = await getAllContractNames();
  
  if (contractNames.length === 0) {
    console.log("⚠️  No contracts found. Make sure contracts are compiled.");
    return;
  }

  console.log(`Found ${contractNames.length} contract(s) to check\n`);
  console.log("=".repeat(80));

  const results = [];
  let totalBytecodeSize = 0;
  let totalDeployedBytecodeSize = 0;
  let contractsExceedingLimit = [];

  // Check each contract
  for (const contractName of contractNames) {
    const result = checkContractSize(contractName);
    
    // Filter out interfaces and abstract contracts (those with 0 bytecode size)
    if (result.error || result.bytecodeSize === 0) {
      continue;
    }
    
    results.push(result);
    totalBytecodeSize += result.bytecodeSize;
    totalDeployedBytecodeSize += result.deployedBytecodeSize;

    if (result.exceedsLimit) {
      contractsExceedingLimit.push(result);
    }
  }

  // Display results
  console.log("\n📊 Contract Bytecode Size Report\n");
  console.log("-".repeat(80));
  console.log(
    `${"Contract Name".padEnd(40)} ${"Bytecode".padEnd(15)} ${"Deployed".padEnd(15)} ${"Status".padEnd(10)}`
  );
  console.log("-".repeat(80));

  for (const result of results) {
    if (result.error) {
      console.log(
        `${result.name.padEnd(40)} ${"N/A".padEnd(15)} ${"N/A".padEnd(15)} ${"❌ Error".padEnd(10)}`
      );
      console.log(`   Error: ${result.error}`);
    } else {
      const bytecodeStr = `${result.bytecodeSize.toLocaleString()} bytes`;
      const deployedStr = `${result.deployedBytecodeSize.toLocaleString()} bytes`;
      const status = result.exceedsLimit
        ? "⚠️  EXCEEDS"
        : "✅ OK";
      const limitStr = result.exceedsLimit
        ? ` (${((result.deployedBytecodeSize / MAX_BYTECODE_SIZE) * 100).toFixed(1)}% of limit)`
        : "";

      console.log(
        `${result.name.padEnd(40)} ${bytecodeStr.padEnd(15)} ${deployedStr.padEnd(15)} ${status.padEnd(10)}${limitStr}`
      );
    }
  }

  console.log("-".repeat(80));
  console.log(
    `\n📈 Summary:\n   Total Bytecode Size: ${totalBytecodeSize.toLocaleString()} bytes`
  );
  console.log(
    `   Total Deployed Size: ${totalDeployedBytecodeSize.toLocaleString()} bytes`
  );
  console.log(`   Size Limit (EIP-170): ${MAX_BYTECODE_SIZE.toLocaleString()} bytes`);

  if (contractsExceedingLimit.length > 0) {
    console.log(`\n⚠️  Warning: ${contractsExceedingLimit.length} contract(s) exceed the size limit:`);
    for (const contract of contractsExceedingLimit) {
      const overage = contract.deployedBytecodeSize - MAX_BYTECODE_SIZE;
      console.log(
        `   - ${contract.name}: ${contract.deployedBytecodeSize.toLocaleString()} bytes (${overage.toLocaleString()} bytes over limit)`
      );
    }
    console.log("\n💡 Consider using libraries or splitting contracts to reduce size.");
  } else {
    console.log("\n✅ All contracts are within the size limit!");
  }

  console.log("\n" + "=".repeat(80));
}

// Run the script
async function main() {
  try {
    await checkAllContractSizes();
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
