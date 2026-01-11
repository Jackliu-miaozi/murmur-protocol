const hre = require("hardhat");
const { ethers } = hre;

// Use the latest deployed AIScoreVerifier address
const AIScoreVerifier_ADDRESS = "0xb91C2eeaA0c475115069a6ED4bc601337a22788E";

async function main() {
  console.log("Checking AIScoreVerifier configuration...\n");

  const provider = hre.ethers.provider;
  const network = await provider.getNetwork();
  console.log(`Network: ${network.name}`);
  console.log(`Chain ID: ${network.chainId}\n`);

  const aiVerifier = await ethers.getContractAt(
    "AIScoreVerifier",
    AIScoreVerifier_ADDRESS
  );

  // Check verifier address
  const verifier = await aiVerifier.verifier();
  console.log(`Verifier address: ${verifier}`);

  // Check deployer address (should match)
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  console.log(`Deployer address: ${deployer.address}\n`);

  // Expected verifier (Alith address)
  const expectedVerifier = "0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac";
  console.log(`Expected verifier (Alith): ${expectedVerifier}\n`);

  if (verifier.toLowerCase() === expectedVerifier.toLowerCase()) {
    console.log("✅ Verifier is correctly set to Alith address");
  } else if (verifier.toLowerCase() === deployer.address.toLowerCase()) {
    console.log("✅ Verifier is set to deployer address");
  } else {
    console.log("⚠️  Verifier does not match expected address!");
    console.log(`   Current: ${verifier}`);
    console.log(`   Expected: ${expectedVerifier}`);
    console.log("   You may need to call setVerifier() with Alith address");
  }

  // Check DOMAIN_SEPARATOR (optional - for debugging)
  try {
    const domainSeparator = await aiVerifier.DOMAIN_SEPARATOR();
    console.log(`\nDOMAIN_SEPARATOR: ${domainSeparator}`);
  } catch (e) {
    console.log("\nCould not read DOMAIN_SEPARATOR (may not be public)");
  }

  // Check signature validity window
  try {
    const validityWindow = await aiVerifier.signatureValidityWindow();
    console.log(`\nSignature Validity Window: ${validityWindow.toString()} seconds (${validityWindow / 60} minutes)`);
  } catch (e) {
    console.log("\nCould not read signatureValidityWindow");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
