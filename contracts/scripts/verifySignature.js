const hre = require("hardhat");
const { ethers } = hre;

const AIScoreVerifier_ADDRESS = "0x348D63E8C09505b89a6a663396f35B3498B0f988";
const VERIFIER_PRIVATE_KEY = "0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133"; // Alith

// Test signature generation
async function generateTestSignature() {
  const provider = hre.ethers.provider;
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  
  console.log(`Network: ${network.name}`);
  console.log(`Chain ID: ${chainId}\n`);

  // Test parameters
  const contentHash = "0x7608845704bd63e059afdae21a726607a220ada50f06167d9bea236910289b5a";
  const length = 136n;
  const aiScore = parseEther("0.5");
  const timestamp = BigInt(Math.floor(Date.now() / 1000));

  console.log("Test parameters:");
  console.log(`  contentHash: ${contentHash}`);
  console.log(`  length: ${length}`);
  console.log(`  aiScore: ${ethers.formatEther(aiScore)}`);
  console.log(`  timestamp: ${timestamp}\n`);

  // Build domain separator (matches contract)
  const domainTypeHash = ethers.keccak256(
    ethers.toUtf8Bytes(
      "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    )
  );

  const domainSeparator = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "bytes32", "bytes32", "uint256", "address"],
      [
        domainTypeHash,
        ethers.keccak256(ethers.toUtf8Bytes("MurmurProtocol")),
        ethers.keccak256(ethers.toUtf8Bytes("1")),
        BigInt(chainId),
        AIScoreVerifier_ADDRESS,
      ]
    )
  );

  console.log(`Calculated DOMAIN_SEPARATOR: ${domainSeparator}`);

  // Get actual DOMAIN_SEPARATOR from contract
  const aiVerifier = await ethers.getContractAt(
    "AIScoreVerifier",
    AIScoreVerifier_ADDRESS
  );
  const actualDomainSeparator = await aiVerifier.DOMAIN_SEPARATOR();
  console.log(`Actual DOMAIN_SEPARATOR:    ${actualDomainSeparator}\n`);

  if (domainSeparator.toLowerCase() === actualDomainSeparator.toLowerCase()) {
    console.log("✅ DOMAIN_SEPARATOR matches!\n");
  } else {
    console.log("❌ DOMAIN_SEPARATOR mismatch!");
    console.log("   This means the chain ID used during deployment differs from current chain ID");
    return;
  }

  // Build TYPE_HASH
  const TYPE_HASH = ethers.keccak256(
    ethers.toUtf8Bytes(
      "AIScore(bytes32 contentHash,uint256 length,uint256 aiScore,uint256 timestamp)"
    )
  );

  // Build struct hash
  const structHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "bytes32", "uint256", "uint256", "uint256"],
      [TYPE_HASH, contentHash, length, aiScore, timestamp]
    )
  );

  // Build EIP-712 hash
  const hash = ethers.keccak256(
    ethers.concat([
      "0x19",
      "0x01",
      domainSeparator,
      structHash,
    ])
  );

  // Sign with verifier private key
  const wallet = new ethers.Wallet(VERIFIER_PRIVATE_KEY);
  const hashBytes = ethers.getBytes(hash);
  const signature = wallet.signingKey.sign(hashBytes);

  const signatureHex = ethers.concat([
    signature.r,
    signature.s,
    ethers.toBeHex(signature.v, 1),
  ]);

  console.log(`Generated signature: ${signatureHex}\n`);

  // Verify signature using contract
  console.log("Verifying signature with contract...");
  const isValid = await aiVerifier.verifyScore(
    contentHash,
    length,
    aiScore,
    timestamp,
    signatureHex
  );

  if (isValid) {
    console.log("✅ Signature is valid!");
  } else {
    console.log("❌ Signature verification failed!");
  }

  function parseEther(value) {
    return ethers.parseEther(value);
  }
}

async function main() {
  await generateTestSignature();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
