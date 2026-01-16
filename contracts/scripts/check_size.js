const fs = require("fs");
const path = require("path");

const artifactPath =
  "/Users/jackliu/Documents/murmur-protocol/murmur-protocol/contracts/artifacts-pvm/contracts/VPToken.sol/VPToken.json";

try {
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const bytecode = artifact.deployedBytecode;

  if (!bytecode) {
    console.error("No deployedBytecode found in artifact.");
    process.exit(1);
  }

  // Bytecode string starts with '0x', so we subtract 2 from length and divide by 2 to get bytes
  const sizeInBytes = (bytecode.length - 2) / 2;
  const sizeInKB = sizeInBytes / 1024;

  console.log(`VPToken Contract Size:`);
  console.log(`- Bytes: ${sizeInBytes}`);
  console.log(`- KB: ${sizeInKB.toFixed(4)} KB`);

  if (sizeInBytes > 24576) {
    // 24KB limit
    console.warn("WARNING: Contract size exceeds 24KB limit!");
  } else {
    console.log("Contract size is within safe limits.");
  }
} catch (error) {
  console.error("Error reading artifact:", error);
}
