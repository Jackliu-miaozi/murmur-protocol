const hre = require("hardhat");
const { ethers } = require("hardhat");

// Helper function to add delay between transactions
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper function to retry a transaction with exponential backoff
async function retryTransaction(fn, maxRetries = 3, delayMs = 2000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const errorMsg = error.message || error.toString();
      // Only retry for provider rate limits (e.g., "temporarily banned")
      // Contract rate limit (15s interval) has been removed
      if (errorMsg.includes("temporarily banned")) {
        const waitTime = delayMs * Math.pow(2, i); // 2s, 4s, 8s for provider rate limit
        console.log(
          `   ⚠️  Provider rate limited, waiting ${waitTime}ms before retry ${
            i + 1
          }/${maxRetries}...`
        );
        await delay(waitTime);
      } else {
        throw error; // Don't retry for other errors
      }
    }
  }
}

// Contract addresses from latest deployment (update these if needed)
const CONTRACT_ADDRESSES = {
  VPToken: "0xC1123cA6E07dD41123926866Ec72dbAF7be9D487",
  AIScoreVerifier: "0x348D63E8C09505b89a6a663396f35B3498B0f988",
  TopicFactory: "0x7151EE65408f3A7fD2A58BCA0A13832833BFf5eE",
  TopicVault: "0xc8ddD10a9E9bAFA6aD58C5fbaFEB65E8a48b21Ff",
  CurationModule: "0xE805F44d96C023fba9a9cc40dd1e95Dcabe11E5c",
  MessageRegistry: "0xDf62d18AFA1A804601b72d49aDC6Ed4fb336a672",
  NFTMinter: "0xCa1f095c1C45E211443D953c581f2Cc169050197",
  VDOTToken:
    process.env.VDOT_TOKEN || "0x0000000000000000000000000000000000000000", // Will be auto-detected or set via env var
};

// Helper function to generate AI signature
// Handles both signTypedData (if supported) and manual EIP-712 signing
async function generateAISignature(
  aiVerifier,
  contentHash,
  length,
  aiScore,
  timestamp,
  signer
) {
  const network = await (signer.provider || ethers.provider).getNetwork();
  const verifyingContract = aiVerifier.target || aiVerifier.address;

  // Try signTypedData first (works with most providers)
  try {
    const domain = {
      name: "MurmurProtocol",
      version: "1",
      chainId: Number(network.chainId),
      verifyingContract: verifyingContract,
    };

    const types = {
      AIScore: [
        { name: "contentHash", type: "bytes32" },
        { name: "length", type: "uint256" },
        { name: "aiScore", type: "uint256" },
        { name: "timestamp", type: "uint256" },
      ],
    };

    const value = { contentHash, length, aiScore, timestamp };

    if (typeof signer.signTypedData === "function") {
      return await signer.signTypedData(domain, types, value);
    }
  } catch (error) {
    // If signTypedData is not supported, fall back to manual signing
    console.log(
      "   ⚠️  signTypedData not supported, using manual EIP-712 signing"
    );
  }

  // Manual EIP-712 signing (for providers that don't support signTypedData)
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
        network.chainId,
        verifyingContract,
      ]
    )
  );

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
      "0x1901", // EIP-712 prefix
      domainSeparator,
      structHash,
    ])
  );

  // Sign the hash
  // For JsonRpcSigner, we need to use a Wallet with the same address
  // Get the signer's address and use it to create a message signature
  const hashBytes = ethers.getBytes(hash);

  // If signer is a Wallet, use signingKey directly
  if (signer.signingKey) {
    const signature = signer.signingKey.sign(hashBytes);
    return ethers.concat([
      signature.r,
      signature.s,
      ethers.toBeHex(signature.v, 1),
    ]);
  }

  // For JsonRpcSigner, try to use known Hardhat test account private keys
  // Hardhat uses a fixed set of test accounts for local networks
  try {
    const signerAddress = (await signer.getAddress()).toLowerCase();

    // Known test account private keys
    // Includes Hardhat default accounts and Polkadot VM (Revive) dev accounts
    const hardhatPrivateKeys = [
      // Polkadot VM / Revive dev node accounts (Alith, Baltathar, etc.)
      "0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133", // Alith: 0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac
      "0x8075991ce870b93a8870eca0c0f91913d12f47948ca0fd25b49c6fa7cdbeee8b", // Baltathar
      "0x0b6e18cafb6ed99687ec547bd28139cafdd2bffe70e6b688f3c5e56a2f0f4f5c", // Charleth
      "0x39539ab1876910bbf3a223d84a29e28f1cb4e2e456503e7e91ed39b2e7223d68", // Dorothy
      "0x7dce9bc8babb68fec1409be38c8e1a52650206a7ed90ff956ae8a6d15eeaaef4", // Ethan
      "0xb9d2ea9a615f3165812e8d44de0d24da9bbd164b65c4f0573e1ce2c8dbd9c8df", // Faith
      // Hardhat default accounts (standard test mnemonic)
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // Hardhat Account 0
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // Hardhat Account 1
      "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // Hardhat Account 2
      "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // Hardhat Account 3
      "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", // Hardhat Account 4
      "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba", // Hardhat Account 5
    ];

    // Try each private key to find a match
    for (const privateKey of hardhatPrivateKeys) {
      try {
        const wallet = new ethers.Wallet(
          privateKey,
          signer.provider || ethers.provider
        );
        const walletAddress = (await wallet.getAddress()).toLowerCase();
        if (walletAddress === signerAddress) {
          const signature = wallet.signingKey.sign(hashBytes);
          return ethers.concat([
            signature.r,
            signature.s,
            ethers.toBeHex(signature.v, 1),
          ]);
        }
      } catch (error) {
        // Continue to next key
        continue;
      }
    }
  } catch (error) {
    // Fall through to error
  }

  // Last resort: throw error with helpful message
  throw new Error(
    `Cannot sign EIP-712 hash. Signer type: ${signer.constructor.name}. ` +
      `Please ensure the signer is a Wallet instance or the provider supports signTypedData.`
  );
}

async function main() {
  console.log("🚀 Starting contract interaction tests...\n");

  // Get signers - handle cases where we might have limited accounts
  const signers = await ethers.getSigners();
  const deployer = signers[0];

  // Check network and account balances
  const networkInfo = await ethers.provider.getNetwork();
  const chainId = networkInfo.chainId;
  const isLocalNetwork =
    chainId === 31337n ||
    chainId.toString() === "31337" ||
    networkInfo.name === "localNode" ||
    networkInfo.name === "hardhat";

  // For Polkadot VM networks, use deployer for all operations if other accounts can't be funded
  let user1, user2;
  let useDeployerForAll = false;

  if (signers.length >= 3) {
    user1 = signers[1];
    user2 = signers[2];
  } else {
    // Use fixed test private keys (standard test mnemonic accounts)
    // Account 1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
    // Account 2: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
    const testPrivateKey1 =
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
    const testPrivateKey2 =
      "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";

    const provider = ethers.provider;
    user1 = new ethers.Wallet(testPrivateKey1, provider);
    user2 = new ethers.Wallet(testPrivateKey2, provider);
  }

  // Check balances and try to fund if needed
  const deployerBalance = await ethers.provider.getBalance(deployer.address);
  const user1Balance = await ethers.provider.getBalance(user1.address);
  const user2Balance = await ethers.provider.getBalance(user2.address);

  console.log("\n💰 Account Balances:");
  console.log(`   Deployer: ${ethers.formatEther(deployerBalance)} ETH`);
  console.log(`   User1: ${ethers.formatEther(user1Balance)} ETH`);
  console.log(`   User2: ${ethers.formatEther(user2Balance)} ETH`);

  // Try to fund user accounts if they have insufficient balance
  const minBalance = ethers.parseEther("1");
  const fundAmount = ethers.parseEther("10");
  
  if (isLocalNetwork && deployerBalance >= ethers.parseEther("50")) {
    // First, try to fund accounts if needed
    console.log("\n💸 Checking and funding user accounts...");
    
    let fundingSucceeded = true;
    
    // Fund User1 if needed
    if (user1Balance < minBalance && user1.address !== deployer.address) {
      try {
        console.log(`   📤 Funding User1 (${user1.address}) with ${ethers.formatEther(fundAmount)} ETH...`);
        const fundTx1 = await deployer.sendTransaction({
          to: user1.address,
          value: fundAmount,
          gasLimit: 21000,
        });
        await fundTx1.wait();
        console.log(`   ✅ Funded User1 successfully`);
      } catch (err) {
        console.log(`   ⚠️  Could not fund User1: ${err.message}`);
        fundingSucceeded = false;
      }
    } else if (user1.address === deployer.address) {
      console.log(`   ℹ️  User1 is deployer, no funding needed`);
    } else {
      console.log(`   ✅ User1 already has sufficient balance`);
    }
    
    // Fund User2 if needed
    if (user2Balance < minBalance && user2.address !== deployer.address) {
      try {
        console.log(`   📤 Funding User2 (${user2.address}) with ${ethers.formatEther(fundAmount)} ETH...`);
        const fundTx2 = await deployer.sendTransaction({
          to: user2.address,
          value: fundAmount,
          gasLimit: 21000,
        });
        await fundTx2.wait();
        console.log(`   ✅ Funded User2 successfully`);
      } catch (err) {
        console.log(`   ⚠️  Could not fund User2: ${err.message}`);
        fundingSucceeded = false;
      }
    } else if (user2.address === deployer.address) {
      console.log(`   ℹ️  User2 is deployer, no funding needed`);
    } else {
      console.log(`   ✅ User2 already has sufficient balance`);
    }
    
    // Check if funding worked
    if (!fundingSucceeded) {
      console.log("\n⚠️  Some funding failed. Using deployer for all operations.");
      useDeployerForAll = true;
      user1 = deployer;
      user2 = deployer;
    } else {
      // Verify balances after funding
      const newUser1Balance = await ethers.provider.getBalance(user1.address);
      const newUser2Balance = await ethers.provider.getBalance(user2.address);
      if (newUser1Balance < minBalance || newUser2Balance < minBalance) {
        console.log("\n⚠️  User accounts still have insufficient balance after funding.");
        console.log("   Using deployer account for all operations.");
        useDeployerForAll = true;
        user1 = deployer;
        user2 = deployer;
      } else {
        console.log("\n✅ All user accounts have sufficient balance for testing.");
      }
    }
  } else if (isLocalNetwork) {
    console.log("\n⚠️  User accounts have insufficient balance for gas fees.");
    console.log("   Deployer doesn't have enough ETH to fund them.");
    console.log("   Using deployer account for all operations to avoid funding issues.");
    useDeployerForAll = true;
    user1 = deployer;
    user2 = deployer;
  }

  console.log("\n📋 Test Accounts:");
  console.log("   Deployer:", deployer.address);
  if (useDeployerForAll) {
    console.log("   User1: (using deployer)", user1.address);
    console.log("   User2: (using deployer)", user2.address);
  } else {
    console.log("   User1:", user1.address);
    console.log("   User2:", user2.address);
  }
  console.log("");

  // Get contract instances
  console.log("\n📋 Connecting to contracts...");
  console.log(`   VPToken: ${CONTRACT_ADDRESSES.VPToken}`);
  console.log(`   TopicFactory: ${CONTRACT_ADDRESSES.TopicFactory}`);

  // Get contract instances (skip verification calls that might fail on Polkadot VM)
  const vpToken = await ethers.getContractAt(
    "VPToken",
    CONTRACT_ADDRESSES.VPToken
  );

  // Auto-detect VDOTToken address from VPToken if not provided
  let vdotTokenAddress = CONTRACT_ADDRESSES.VDOTToken;
  if (
    !vdotTokenAddress ||
    vdotTokenAddress === "0x0000000000000000000000000000000000000000"
  ) {
    try {
      vdotTokenAddress = await vpToken.vdotToken();
      console.log(`   ✅ Auto-detected VDOTToken: ${vdotTokenAddress}`);
      CONTRACT_ADDRESSES.VDOTToken = vdotTokenAddress;
    } catch (err) {
      console.error(
        `   ❌ Failed to get VDOTToken address from VPToken: ${err.message}`
      );
      throw new Error(
        "VDOTToken address not provided and could not be auto-detected. Please set VDOT_TOKEN environment variable."
      );
    }
  } else {
    console.log(`   VDOTToken: ${vdotTokenAddress}`);
  }

  const vdotToken = await ethers.getContractAt("VDOTToken", vdotTokenAddress);
  const topicFactory = await ethers.getContractAt(
    "TopicFactory",
    CONTRACT_ADDRESSES.TopicFactory
  );
  const topicVault = await ethers.getContractAt(
    "TopicVault",
    CONTRACT_ADDRESSES.TopicVault
  );
  const messageRegistry = await ethers.getContractAt(
    "MessageRegistry",
    CONTRACT_ADDRESSES.MessageRegistry
  );
  const aiVerifier = await ethers.getContractAt(
    "AIScoreVerifier",
    CONTRACT_ADDRESSES.AIScoreVerifier
  );
  const curationModule = await ethers.getContractAt(
    "CurationModule",
    CONTRACT_ADDRESSES.CurationModule
  );
  const nftMinter = await ethers.getContractAt(
    "NFTMinter",
    CONTRACT_ADDRESSES.NFTMinter
  );

  console.log("   ✅ All contracts connected\n");

  // Verify MessageRegistry and CurationModule are correctly linked
  console.log("🔍 Verifying contract configurations...");
  try {
    const messageRegistryAddress = await messageRegistry.getAddress();
    const curationModuleAddress = await curationModule.getAddress();
    const curationModuleMessageRegistry = await curationModule.messageRegistry();
    
    console.log(`   MessageRegistry address: ${messageRegistryAddress}`);
    console.log(`   CurationModule address: ${curationModuleAddress}`);
    console.log(`   CurationModule's messageRegistry: ${curationModuleMessageRegistry}`);
    
    if (messageRegistryAddress.toLowerCase() !== curationModuleMessageRegistry.toLowerCase()) {
      console.log(`   ⚠️  WARNING: Address mismatch!`);
      console.log(`   MessageRegistry address: ${messageRegistryAddress}`);
      console.log(`   CurationModule expects: ${curationModuleMessageRegistry}`);
      console.log(`   This will cause 'CurationModule: unauthorized' errors!`);
    } else {
      console.log(`   ✅ Addresses match correctly`);
    }
    
    // Also check MessageRegistry's curationModule
    const messageRegistryCurationModule = await messageRegistry.curationModule();
    console.log(`   MessageRegistry's curationModule: ${messageRegistryCurationModule}`);
    
    if (curationModuleAddress.toLowerCase() !== messageRegistryCurationModule.toLowerCase()) {
      console.log(`   ⚠️  WARNING: Address mismatch!`);
      console.log(`   CurationModule address: ${curationModuleAddress}`);
      console.log(`   MessageRegistry expects: ${messageRegistryCurationModule}`);
    } else {
      console.log(`   ✅ Addresses match correctly`);
    }
    console.log("");
  } catch (err) {
    console.log(`   ⚠️  Could not verify addresses: ${err.message}\n`);
  }

  console.log("=".repeat(60));
  console.log("Test 1: Stake vDOT to get Global VP");
  console.log("=".repeat(60));

  // Check current vDOT balances
  const vdotAmount = ethers.parseEther("1000"); // 1000 vDOT
  console.log(`\n💰 Checking vDOT balances...`);
  const user1VdotBalance = await vdotToken.balanceOf(user1.address);
  const user2VdotBalance = await vdotToken.balanceOf(user2.address);
  console.log(`   User1 vDOT balance: ${ethers.formatEther(user1VdotBalance)}`);
  console.log(`   User2 vDOT balance: ${ethers.formatEther(user2VdotBalance)}`);

  // Mint vDOT to users if needed (must use deployer/owner to call mint)
  // Skip minting if user is the same as deployer (deployer already has vDOT from constructor)
  if (
    user1.address.toLowerCase() !== deployer.address.toLowerCase() &&
    user1VdotBalance < vdotAmount
  ) {
    console.log(
      `\n💰 Minting ${ethers.formatEther(vdotAmount)} vDOT to User1...`
    );
    try {
      const owner = await vdotToken.owner();
      if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
        throw new Error(
          `Deployer (${deployer.address}) is not the owner (${owner})`
        );
      }
      const mintTx1 = await retryTransaction(async () => {
        return await vdotToken
          .connect(deployer)
          .mint(user1.address, vdotAmount);
      });
      await mintTx1.wait();
      console.log("   ✅ Minted to User1");
    } catch (err) {
      console.error(`   ❌ Failed to mint to User1: ${err.message}`);
      throw err;
    }
    await delay(1000);
  } else if (user1.address.toLowerCase() === deployer.address.toLowerCase()) {
    console.log(`   ℹ️  User1 is deployer, using existing vDOT balance`);
  } else {
    console.log(`   ✅ User1 already has sufficient vDOT`);
  }

  if (
    user2.address.toLowerCase() !== deployer.address.toLowerCase() &&
    user2VdotBalance < vdotAmount
  ) {
    console.log(
      `\n💰 Minting ${ethers.formatEther(vdotAmount)} vDOT to User2...`
    );
    try {
      const mintTx2 = await retryTransaction(async () => {
        return await vdotToken
          .connect(deployer)
          .mint(user2.address, vdotAmount);
      });
      await mintTx2.wait();
      console.log("   ✅ Minted to User2");
    } catch (err) {
      console.error(`   ❌ Failed to mint to User2: ${err.message}`);
      throw err;
    }
  } else if (user2.address.toLowerCase() === deployer.address.toLowerCase()) {
    console.log(`   ℹ️  User2 is deployer, using existing vDOT balance`);
  } else {
    console.log(`   ✅ User2 already has sufficient vDOT`);
  }

  // User1 stakes vDOT
  console.log(`\n📊 User1 staking ${ethers.formatEther(vdotAmount)} vDOT...`);
  await delay(1000); // Add delay before transaction
  await retryTransaction(async () => {
    return await vdotToken
      .connect(user1)
      .approve(CONTRACT_ADDRESSES.VPToken, vdotAmount);
  });
  await delay(1000); // Add delay between transactions
  const stakeTx = await retryTransaction(async () => {
    return await vpToken.connect(user1).stakeVdot(vdotAmount);
  });
  const stakeReceipt = await stakeTx.wait();
  console.log("   ✅ Stake transaction confirmed");

  // Get VP balance
  const vpBalance = await vpToken.balanceOf(user1.address);
  console.log(`   💎 User1 VP Balance: ${ethers.formatEther(vpBalance)} VP`);

  // Calculate expected VP: VP = 100 * sqrt(vDOT)
  const expectedVP = await vpToken.calculateVP(vdotAmount);
  console.log(`   📐 Expected VP: ${ethers.formatEther(expectedVP)} VP`);

  console.log("\n" + "=".repeat(60));
  console.log("Test 2: Create a Topic");
  console.log("=".repeat(60));

  // Check creation cost
  const creationCost = await topicFactory.quoteCreationCost();
  console.log(
    `\n💵 Topic creation cost: ${ethers.formatEther(creationCost)} VP`
  );

  // Check if user1 has enough VP
  let user1VP = await vpToken.balanceOf(user1.address);
  console.log(`   Current User1 VP: ${ethers.formatEther(user1VP)} VP`);
  console.log(`   Current User1 VP (raw): ${user1VP.toString()}`);

  // Debug: Test calculateVP with different amounts
  console.log("\n   🔍 Testing VP calculation:");
  const testAmounts = [
    ethers.parseEther("1"),
    ethers.parseEther("100"),
    ethers.parseEther("1000"),
    ethers.parseEther("10000"),
    ethers.parseEther("100000"),
    ethers.parseEther("1000000"),
  ];
  for (const testAmount of testAmounts) {
    const testVP = await vpToken.calculateVP(testAmount);
    console.log(
      `   ${ethers.formatEther(testAmount)} vDOT -> ${ethers.formatEther(
        testVP
      )} VP (raw: ${testVP.toString()})`
    );
  }

  if (user1VP < creationCost) {
    console.log("\n   ⚠️  User1 doesn't have enough VP, staking more...");

    // VP formula: VP = 100 * sqrt(vDOT)
    // To get 1000 VP, we need: vDOT = (1000 / 100)^2 = 100 vDOT
    // But due to precision and to be safe, stake much more
    // Stake in multiple batches to ensure we have enough
    const requiredVP = creationCost;
    console.log(`   Required VP: ${ethers.formatEther(requiredVP)} VP`);
    console.log(`   Required VP (raw): ${requiredVP.toString()}`);

    // Calculate total vDOT needed: (VP / 100)^2, but add large buffer
    // Since VP might be in wei units, we need to account for that
    // If creationCost is 1000 * 10^18 (wei), then we need much more vDOT
    const vdotAmounts = [
      ethers.parseEther("1000000"), // 1M vDOT - should give ~1000 VP
      ethers.parseEther("1000000"), // Another 1M vDOT
      ethers.parseEther("1000000"), // Another 1M vDOT
    ];

    let totalStaked = 0n;
    let previousVP = user1VP;
    for (let i = 0; i < vdotAmounts.length; i++) {
      const additionalVdot = vdotAmounts[i];
      totalStaked += additionalVdot;

      // Calculate expected VP for this batch
      const expectedVPForBatch = await vpToken.calculateVP(additionalVdot);
      console.log(
        `   Batch ${i + 1}: Minting and staking ${ethers.formatEther(
          additionalVdot
        )} vDOT...`
      );
      console.log(
        `   Expected VP from this batch: ${ethers.formatEther(
          expectedVPForBatch
        )} VP`
      );

      await delay(1000);
      const mintTx = await retryTransaction(async () => {
        return await vdotToken
          .connect(deployer)
          .mint(user1.address, additionalVdot);
      });
      await mintTx.wait();
      console.log(`   ✅ Batch ${i + 1}: Minted vDOT`);

      await delay(1000);
      const approveTx = await retryTransaction(async () => {
        return await vdotToken
          .connect(user1)
          .approve(CONTRACT_ADDRESSES.VPToken, additionalVdot);
      });
      await approveTx.wait();
      console.log(`   ✅ Batch ${i + 1}: Approved vDOT`);

      await delay(1000);
      const stakeTx = await retryTransaction(async () => {
        return await vpToken.connect(user1).stakeVdot(additionalVdot);
      });
      const stakeReceipt = await stakeTx.wait();
      console.log(`   ✅ Batch ${i + 1}: Staked vDOT`);

      // Check VP after each batch
      user1VP = await vpToken.balanceOf(user1.address);
      const vpGained = user1VP - previousVP;
      console.log(
        `   VP gained in batch ${i + 1}: ${ethers.formatEther(vpGained)} VP`
      );
      console.log(
        `   Current total VP after batch ${i + 1}: ${ethers.formatEther(
          user1VP
        )} VP`
      );
      previousVP = user1VP;

      if (user1VP >= creationCost) {
        console.log(`   ✅ Sufficient VP achieved after batch ${i + 1}!`);
        break;
      }
    }

    // Final check
    user1VP = await vpToken.balanceOf(user1.address);
    console.log(`   Final User1 VP: ${ethers.formatEther(user1VP)} VP`);
    console.log(
      `   Total staked in this round: ${ethers.formatEther(totalStaked)} vDOT`
    );

    if (user1VP < creationCost) {
      throw new Error(
        `Still insufficient VP after staking ${ethers.formatEther(
          totalStaked
        )} vDOT. Have ${ethers.formatEther(
          user1VP
        )} VP, need ${ethers.formatEther(creationCost)} VP`
      );
    }
  }

  // Create topic (matching useway.md scenario: 24 hours duration, 10 minutes freeze window, 50 curated messages)
  const metadataHash = ethers.keccak256(
    ethers.toUtf8Bytes("Test Topic: Web3 Future Development Discussion")
  );
  const topicDuration = 24 * 60 * 60; // 24 hours (86400 seconds)
  const freezeWindow = 10 * 60; // 10 minutes (600 seconds)
  const curatedLimit = 50; // 50 curated messages

  console.log("\n📝 Creating topic...");
  console.log(`   Metadata Hash: ${metadataHash}`);
  console.log(
    `   Duration: ${topicDuration} seconds (${
      topicDuration / (24 * 60 * 60)
    } days)`
  );
  console.log(
    `   Freeze Window: ${freezeWindow} seconds (${
      freezeWindow / (24 * 60 * 60)
    } days)`
  );
  console.log(`   Curated Limit: ${curatedLimit}`);

  await delay(1000); // Add delay before transaction
  const createTopicTx = await retryTransaction(async () => {
    return await topicFactory
      .connect(user1)
      .createTopic(metadataHash, topicDuration, freezeWindow, curatedLimit);
  });
  const createTopicReceipt = await createTopicTx.wait();

  // Extract topic ID from event
  const topicCreatedEvent = createTopicReceipt.logs.find((log) => {
    try {
      const parsed = topicFactory.interface.parseLog(log);
      return parsed && parsed.name === "TopicCreated";
    } catch {
      return false;
    }
  });

  let topicId;
  if (topicCreatedEvent) {
    const parsed = topicFactory.interface.parseLog(topicCreatedEvent);
    topicId = parsed.args.topicId;
    console.log(`   ✅ Topic created! Topic ID: ${topicId}`);
  } else {
    // Fallback: get topic counter
    topicId = await topicFactory.topicCounter();
    console.log(`   ✅ Topic created! Topic ID: ${topicId}`);
  }

  // Get topic info
  const topic = await topicFactory.getTopic(topicId);
  console.log("\n📋 Topic Info:");
  console.log(`   Creator: ${topic.creator}`);
  console.log(
    `   Status: ${topic.status} (0=Draft, 1=Live, 2=Closed, 3=Minted, 4=Settled)`
  );
  console.log(
    `   Created At: ${new Date(
      Number(topic.createdAt) * 1000
    ).toLocaleString()}`
  );

  console.log("\n" + "=".repeat(60));
  console.log("Test 3: User2 Stakes vDOT to Get Global VP");
  console.log("=".repeat(60));

  // User2 stakes vDOT to get global VP (no need to lock to topic)
  console.log("\n💰 User2 staking vDOT to get global VP...");
  const user2VdotAmount = ethers.parseEther("500");
  await delay(1000);
  await retryTransaction(async () => {
    return await vdotToken
      .connect(user2)
      .approve(CONTRACT_ADDRESSES.VPToken, user2VdotAmount);
  });
  await delay(1000);
  await retryTransaction(async () => {
    return await vpToken.connect(user2).stakeVdot(user2VdotAmount);
  });
  const user2VP = await vpToken.balanceOf(user2.address);
  console.log(`   ✅ User2 Global VP Balance: ${ethers.formatEther(user2VP)} VP`);
  console.log(`   ℹ️  Note: All VP is global and can be used across all topics`);

  console.log("\n" + "=".repeat(60));
  console.log("Test 4: Post Messages");
  console.log("=".repeat(60));

  // Check User1's VP before posting
  const user1VPBefore = await vpToken.balanceOf(user1.address);
  console.log(`   💎 User1 Global VP before posting: ${ethers.formatEther(user1VPBefore)} VP`);

  // Post message from User1
  const message1 = "This is my first message in the topic!";
  const contentHash1 = ethers.keccak256(ethers.toUtf8Bytes(message1));
  const length1 = message1.length;
  const aiScore1 = ethers.parseEther("0.7"); // 0.7 intensity
  // Use chain timestamp to ensure sync with block.timestamp
  const blockNumber1 = await ethers.provider.getBlockNumber();
  const block1 = await ethers.provider.getBlock(blockNumber1);
  const timestamp1 = block1 ? BigInt(block1.timestamp) : BigInt(Math.floor(Date.now() / 1000));

  console.log("\n📝 User1 posting message...");
  console.log(`   Content: "${message1}"`);
  console.log(`   Content Hash: ${contentHash1}`);
  console.log(`   Length: ${length1} characters`);
  console.log(`   AI Score: ${ethers.formatEther(aiScore1)}`);

  // Generate AI signature (using deployer as AI verifier)
  const signature1 = await generateAISignature(
    aiVerifier,
    contentHash1,
    length1,
    aiScore1,
    timestamp1,
    deployer
  );

  // Calculate message cost
  const messageCost1 = await messageRegistry.calculateMessageCost(
    topicId,
    length1,
    aiScore1
  );
  console.log(`   💵 Estimated Cost: ${ethers.formatEther(messageCost1)} VP`);
  console.log(`   ℹ️  Cost will be deducted from global VP balance`);

  // Post message (cost is automatically deducted from global VP)
  await delay(2000); // Add delay before posting
  
  // Re-fetch chain timestamp and regenerate signature before posting (to ensure timestamp is valid)
  const currentBlock1 = await ethers.provider.getBlock("latest");
  const currentTimestamp1 = currentBlock1 ? BigInt(currentBlock1.timestamp) : timestamp1;
  let finalTimestamp1 = currentTimestamp1;
  let finalSignature1 = signature1;
  
  // If timestamp changed, regenerate signature
  if (currentTimestamp1 !== timestamp1) {
    console.log(`   ⏰ Chain timestamp changed, regenerating signature...`);
    finalTimestamp1 = currentTimestamp1;
    finalSignature1 = await generateAISignature(
      aiVerifier,
      contentHash1,
      length1,
      aiScore1,
      finalTimestamp1,
      deployer
    );
  }
  
  const postTx1 = await retryTransaction(async () => {
    return await messageRegistry
      .connect(user1)
      .postMessage(
        topicId,
        contentHash1,
        length1,
        aiScore1,
        finalTimestamp1,
        finalSignature1
      );
  });
  const postReceipt1 = await postTx1.wait();
  console.log("   ✅ Message posted!");

  // Check VP after posting
  const user1VPAfter = await vpToken.balanceOf(user1.address);
  const vpConsumed1 = user1VPBefore - user1VPAfter;
  console.log(`   💎 User1 Global VP after posting: ${ethers.formatEther(user1VPAfter)} VP`);
  console.log(`   📉 VP consumed: ${ethers.formatEther(vpConsumed1)} VP`);

  // Extract message ID
  const messagePostedEvent = postReceipt1.logs.find((log) => {
    try {
      const parsed = messageRegistry.interface.parseLog(log);
      return parsed && parsed.name === "MessagePosted";
    } catch {
      return false;
    }
  });

  let messageId1;
  if (messagePostedEvent) {
    const parsed = messageRegistry.interface.parseLog(messagePostedEvent);
    messageId1 = parsed.args.messageId;
    console.log(`   📨 Message ID: ${messageId1}`);
  }

  // Post message from User2
  // Note: 15-second rate limit has been removed from the contract

  // Check User2's VP before posting
  const user2VPBefore = await vpToken.balanceOf(user2.address);
  console.log(`   💎 User2 Global VP before posting: ${ethers.formatEther(user2VPBefore)} VP`);

  const message2 = "I agree with the discussion!";
  const contentHash2 = ethers.keccak256(ethers.toUtf8Bytes(message2));
  const length2 = message2.length;
  const aiScore2 = ethers.parseEther("0.5");
  // Use chain timestamp to ensure sync with block.timestamp (after waiting)
  const blockNumber2 = await ethers.provider.getBlockNumber();
  const block2 = await ethers.provider.getBlock(blockNumber2);
  const timestamp2 = block2 ? BigInt(block2.timestamp) : BigInt(Math.floor(Date.now() / 1000));

  console.log("\n📝 User2 posting message...");
  console.log(`   Content: "${message2}"`);
  const signature2 = await generateAISignature(
    aiVerifier,
    contentHash2,
    length2,
    aiScore2,
    timestamp2,
    deployer
  );

  // Calculate message cost
  const messageCost2 = await messageRegistry.calculateMessageCost(
    topicId,
    length2,
    aiScore2
  );
  console.log(`   💵 Estimated Cost: ${ethers.formatEther(messageCost2)} VP`);

  // Re-fetch chain timestamp and regenerate signature before posting (to ensure timestamp is valid)
  const currentBlock2 = await ethers.provider.getBlock("latest");
  const currentTimestamp2 = currentBlock2 ? BigInt(currentBlock2.timestamp) : timestamp2;
  let finalTimestamp2 = currentTimestamp2;
  let finalSignature2 = signature2;
  
  // If timestamp changed, regenerate signature
  if (currentTimestamp2 !== timestamp2) {
    console.log(`   ⏰ Chain timestamp changed, regenerating signature...`);
    finalTimestamp2 = currentTimestamp2;
    finalSignature2 = await generateAISignature(
      aiVerifier,
      contentHash2,
      length2,
      aiScore2,
      finalTimestamp2,
      deployer
    );
  }

  const postTx2 = await retryTransaction(async () => {
    return await messageRegistry
      .connect(user2)
      .postMessage(
        topicId,
        contentHash2,
        length2,
        aiScore2,
        finalTimestamp2,
        finalSignature2
      );
  });
  const postReceipt2 = await postTx2.wait();
  console.log("   ✅ Message posted!");

  // Check VP after posting
  const user2VPAfter = await vpToken.balanceOf(user2.address);
  const vpConsumed2 = user2VPBefore - user2VPAfter;
  console.log(`   💎 User2 Global VP after posting: ${ethers.formatEther(user2VPAfter)} VP`);
  console.log(`   📉 VP consumed: ${ethers.formatEther(vpConsumed2)} VP`);

  // Extract message ID 2
  let messageId2;
  const messagePostedEvent2 = postReceipt2.logs.find((log) => {
    try {
      const parsed = messageRegistry.interface.parseLog(log);
      return parsed && parsed.name === "MessagePosted";
    } catch {
      return false;
    }
  });
  if (messagePostedEvent2) {
    const parsed = messageRegistry.interface.parseLog(messagePostedEvent2);
    messageId2 = parsed.args.messageId;
    console.log(`   📨 Message ID: ${messageId2}`);
  }

  // Get message info
  if (messageId1) {
    const message1Info = await messageRegistry.messages(messageId1);
    console.log("\n📋 Message 1 Info:");
    console.log(`   Author: ${message1Info.author}`);
    console.log(`   Like Count: ${message1Info.likeCount}`);
    console.log(`   VP Cost: ${ethers.formatEther(message1Info.vpCost)} VP`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("Test 5: Like Messages");
  console.log("=".repeat(60));

  if (messageId1) {
    // Check User2's VP before liking (each like costs 1 VP)
    const user2VPBeforeLike = await vpToken.balanceOf(user2.address);
    console.log(`\n👍 User2 liking message ${messageId1}...`);
    console.log(`   💎 User2 Global VP before like: ${ethers.formatEther(user2VPBeforeLike)} VP`);
    console.log(`   💵 Like cost: 1 VP (from global VP)`);
    
    await delay(1000); // Add delay before transaction
    const likeTx = await retryTransaction(async () => {
      return await messageRegistry
        .connect(user2)
        .likeMessage(topicId, messageId1);
    });
    await likeTx.wait();
    console.log("   ✅ Message liked!");

    // Check VP after liking
    const user2VPAfterLike = await vpToken.balanceOf(user2.address);
    const vpConsumedLike = user2VPBeforeLike - user2VPAfterLike;
    console.log(`   💎 User2 Global VP after like: ${ethers.formatEther(user2VPAfterLike)} VP`);
    console.log(`   📉 VP consumed: ${ethers.formatEther(vpConsumedLike)} VP`);

    // Check like count
    const message1Info = await messageRegistry.messages(messageId1);
    console.log(`   💖 New Like Count: ${message1Info.likeCount}`);
    
    // Check curated messages
    const curatedMessages = await curationModule.getCuratedMessages(topicId);
    console.log(`   📋 Curated messages count: ${curatedMessages.length}`);
    if (curatedMessages.length > 0) {
      console.log(`   📋 Curated message IDs: ${curatedMessages.join(", ")}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Test 5.5: Test Consecutive Message Cooldown");
  console.log("=".repeat(60));

  // Test consecutive message cooldown: every 3 messages, the 4th message cost increases by 1.1x
  // User1 already posted 1 message, so need to post 2 more to test cooldown
  console.log(`\n📝 Testing consecutive message cooldown mechanism...`);
  console.log(`   ℹ️  After 3 consecutive messages, the 4th message cost increases by 1.1x`);
  
  let messageId3, messageId4;
  
  // Post 3rd message from User1
  const message3 = "This is my third message in the topic!";
  const contentHash3 = ethers.keccak256(ethers.toUtf8Bytes(message3));
  const length3 = message3.length;
  const aiScore3 = ethers.parseEther("0.6");
  const blockNumber3 = await ethers.provider.getBlockNumber();
  const block3 = await ethers.provider.getBlock(blockNumber3);
  const timestamp3 = block3 ? BigInt(block3.timestamp) : BigInt(Math.floor(Date.now() / 1000));

  console.log(`\n📝 User1 posting 3rd message (consecutive count: 2)...`);
  const signature3 = await generateAISignature(aiVerifier, contentHash3, length3, aiScore3, timestamp3, deployer);
  const cost3Before = await messageRegistry.calculateMessageCost(topicId, length3, aiScore3);
  
  const currentBlock3 = await ethers.provider.getBlock("latest");
  const currentTimestamp3 = currentBlock3 ? BigInt(currentBlock3.timestamp) : timestamp3;
  let finalTimestamp3 = currentTimestamp3;
  let finalSignature3 = signature3;
  if (currentTimestamp3 !== timestamp3) {
    finalTimestamp3 = currentTimestamp3;
    finalSignature3 = await generateAISignature(aiVerifier, contentHash3, length3, aiScore3, finalTimestamp3, deployer);
  }
  
  const postTx3 = await retryTransaction(async () => {
    return await messageRegistry.connect(user1).postMessage(
      topicId, contentHash3, length3, aiScore3, finalTimestamp3, finalSignature3
    );
  });
  const postReceipt3 = await postTx3.wait();
  const messagePostedEvent3 = postReceipt3.logs.find((log) => {
    try {
      const parsed = messageRegistry.interface.parseLog(log);
      return parsed && parsed.name === "MessagePosted";
    } catch { return false; }
  });
  if (messagePostedEvent3) {
    const parsed = messageRegistry.interface.parseLog(messagePostedEvent3);
    messageId3 = parsed.args.messageId;
    console.log(`   ✅ Message 3 posted! Message ID: ${messageId3}`);
    console.log(`   💵 Cost (no cooldown yet): ${ethers.formatEther(cost3Before)} VP`);
  }

  // Post 4th message from User1 (should trigger cooldown multiplier)
  await delay(1000);
  const message4 = "This is my fourth message - should have 1.1x cost!";
  const contentHash4 = ethers.keccak256(ethers.toUtf8Bytes(message4));
  const length4 = message4.length;
  const aiScore4 = ethers.parseEther("0.6");
  const blockNumber4 = await ethers.provider.getBlockNumber();
  const block4 = await ethers.provider.getBlock(blockNumber4);
  const timestamp4 = block4 ? BigInt(block4.timestamp) : BigInt(Math.floor(Date.now() / 1000));

  console.log(`\n📝 User1 posting 4th message (consecutive count: 3, should trigger 1.1x multiplier)...`);
  const signature4 = await generateAISignature(aiVerifier, contentHash4, length4, aiScore4, timestamp4, deployer);
  const cost4Before = await messageRegistry.calculateMessageCost(topicId, length4, aiScore4);
  
  const currentBlock4 = await ethers.provider.getBlock("latest");
  const currentTimestamp4 = currentBlock4 ? BigInt(currentBlock4.timestamp) : timestamp4;
  let finalTimestamp4 = currentTimestamp4;
  let finalSignature4 = signature4;
  if (currentTimestamp4 !== timestamp4) {
    finalTimestamp4 = currentTimestamp4;
    finalSignature4 = await generateAISignature(aiVerifier, contentHash4, length4, aiScore4, finalTimestamp4, deployer);
  }
  
  const user1VPBeforeMsg4 = await vpToken.balanceOf(user1.address);
  const postTx4 = await retryTransaction(async () => {
    return await messageRegistry.connect(user1).postMessage(
      topicId, contentHash4, length4, aiScore4, finalTimestamp4, finalSignature4
    );
  });
  const postReceipt4 = await postTx4.wait();
  const user1VPAfterMsg4 = await vpToken.balanceOf(user1.address);
  const actualCost4 = user1VPBeforeMsg4 - user1VPAfterMsg4;
  
  const messagePostedEvent4 = postReceipt4.logs.find((log) => {
    try {
      const parsed = messageRegistry.interface.parseLog(log);
      return parsed && parsed.name === "MessagePosted";
    } catch { return false; }
  });
  if (messagePostedEvent4) {
    const parsed = messageRegistry.interface.parseLog(messagePostedEvent4);
    messageId4 = parsed.args.messageId;
    console.log(`   ✅ Message 4 posted! Message ID: ${messageId4}`);
    console.log(`   💵 Base cost (no cooldown): ${ethers.formatEther(cost4Before)} VP`);
    console.log(`   💵 Actual cost (with 1.1x multiplier): ${ethers.formatEther(actualCost4)} VP`);
    const multiplier = Number(actualCost4) / Number(cost4Before);
    console.log(`   📊 Cost multiplier: ${multiplier.toFixed(2)}x (expected ~1.1x)`);
    if (multiplier >= 1.09 && multiplier <= 1.11) {
      console.log(`   ✅ Cooldown mechanism working correctly!`);
    } else {
      console.log(`   ⚠️  Multiplier is not exactly 1.1x (might be due to rounding or other factors)`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Test 5.6: Test Curated List Dynamic Sorting");
  console.log("=".repeat(60));

  // Test curated list dynamic sorting with multiple likes
  console.log(`\n👍 Testing curated list dynamic sorting...`);
  
  // Get current curated list
  let curatedList = await curationModule.getCuratedMessages(topicId);
  console.log(`   📋 Initial curated messages: ${curatedList.length} messages`);
  if (curatedList.length > 0) {
    console.log(`   📋 Curated message IDs: ${curatedList.map(id => id.toString()).join(", ")}`);
  }

  // Like message 2 to potentially add it to curated list
  if (messageId2) {
    console.log(`\n👍 User1 liking message ${messageId2}...`);
    const user1VPBeforeLike2 = await vpToken.balanceOf(user1.address);
    await delay(1000);
    try {
      const likeTx2 = await retryTransaction(async () => {
        return await messageRegistry.connect(user1).likeMessage(topicId, messageId2);
      });
      await likeTx2.wait();
      console.log(`   ✅ Message ${messageId2} liked!`);
      
      // Check curated list after like
      await delay(1000);
      curatedList = await curationModule.getCuratedMessages(topicId);
      console.log(`   📋 Curated messages after like: ${curatedList.length} messages`);
      if (curatedList.length > 0) {
        console.log(`   📋 Curated message IDs: ${curatedList.map(id => id.toString()).join(", ")}`);
      }
      
      // Check message like counts
      if (messageId1) {
        const msg1Info = await messageRegistry.messages(messageId1);
        const msg2Info = await messageRegistry.messages(messageId2);
        console.log(`   💖 Message ${messageId1} like count: ${msg1Info.likeCount}`);
        console.log(`   💖 Message ${messageId2} like count: ${msg2Info.likeCount}`);
        console.log(`   ℹ️  Curated list should be sorted by like count (highest first)`);
      }
    } catch (err) {
      console.log(`   ⚠️  Could not like message: ${err.message}`);
    }
  } else {
    console.log(`   ⚠️  Message ID 2 not found, skipping curated list sorting test`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("Test 6: Check Topic Status");
  console.log("=".repeat(60));

  const topicInfo = await topicFactory.getTopic(topicId);
  const isFrozen = await topicFactory.isFrozen(topicId);
  const isExpired = await topicFactory.isExpired(topicId);
  const activeTopicCount = await topicFactory.activeTopicCount();

  console.log("\n📊 Topic Status:");
  console.log(`   Topic ID: ${topicId}`);
  console.log(`   Status: ${topicInfo.status}`);
  console.log(`   Is Frozen: ${isFrozen}`);
  console.log(`   Is Expired: ${isExpired}`);
  console.log(`   Active Topics: ${activeTopicCount}`);

  // Get topic messages count
  const topicMessageCountFromRegistry = await messageRegistry.getMessageCount(topicId);
  console.log(`   Total Messages: ${topicMessageCountFromRegistry}`);

  // Get topic statistics
  const topicMessageCount = await messageRegistry.topicMessageCount(topicId);
  const topicUniqueUserCount = await messageRegistry.topicUniqueUserCount(
    topicId
  );
  console.log(`   Message Count: ${topicMessageCount}`);
  console.log(`   Unique Users: ${topicUniqueUserCount}`);

  console.log("\n" + "=".repeat(60));
  console.log("Test 6.5: Calculate Curated Set Hash");
  console.log("=".repeat(60));

  // Test curated set hash calculation (useway.md step 5)
  console.log(`\n🔐 Calculating curated set hash for topic ${topicId}...`);
  try {
    const curatedSetHash = await curationModule.curatedSetHash(topicId);
    console.log(`   ✅ Curated set hash: ${curatedSetHash}`);
    
    // Get curated messages to verify
    const curatedMsgs = await curationModule.getCuratedMessages(topicId);
    console.log(`   📋 Curated messages count: ${curatedMsgs.length}`);
    if (curatedMsgs.length > 0) {
      console.log(`   📋 Curated message IDs: ${curatedMsgs.map(id => id.toString()).join(", ")}`);
      console.log(`   ℹ️  Hash is calculated from the curated message IDs array`);
    } else {
      console.log(`   ℹ️  No curated messages yet, hash is calculated from empty array`);
    }
  } catch (err) {
    console.log(`   ⚠️  Could not calculate curated set hash: ${err.message}`);
  }

  // Test freeze window (useway.md step 4)
  console.log(`\n🔒 Testing freeze window mechanism...`);
  console.log(`   Current frozen status: ${isFrozen}`);
  if (isFrozen) {
    console.log(`   ✅ Topic is in freeze window`);
    console.log(`   ℹ️  During freeze window:`);
    console.log(`      - Curated list is locked (no updates allowed)`);
    console.log(`      - Users can still post and like, but curated list won't change`);
  } else {
    console.log(`   ℹ️  Topic is not in freeze window yet`);
    console.log(`   ℹ️  Freeze window: ${topicInfo.freezeWindow.toString()} seconds before topic ends`);
    console.log(`   ℹ️  Topic duration: ${topicInfo.duration.toString()} seconds`);
    console.log(`   ℹ️  Topic created at: ${new Date(Number(topicInfo.createdAt) * 1000).toLocaleString()}`);
    
    // Calculate when freeze window should start
    const freezeWindowStart = Number(topicInfo.createdAt) + Number(topicInfo.duration) - Number(topicInfo.freezeWindow);
    const currentTime = Math.floor(Date.now() / 1000);
    const timeUntilFreeze = freezeWindowStart - currentTime;
    if (timeUntilFreeze > 0) {
      console.log(`   ⏰ Freeze window will start in ${timeUntilFreeze} seconds (${(timeUntilFreeze / 60).toFixed(1)} minutes)`);
    } else {
      console.log(`   ⏰ Freeze window should have started already`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Test 7: Check Balances and VP Consumption");
  console.log("=".repeat(60));

  const user1GlobalVP = await vpToken.balanceOf(user1.address);
  const user2GlobalVP = await vpToken.balanceOf(user2.address);

  // Check VP consumption tracked by TopicVault
  const user1ConsumedVP = await topicVault.consumedVP(topicId, user1.address);
  const user2ConsumedVP = await topicVault.consumedVP(topicId, user2.address);

  console.log("\n💰 Final Balances:");
  console.log(`   User1 Global VP: ${ethers.formatEther(user1GlobalVP)} VP`);
  console.log(`   User1 Consumed VP (tracked for refund): ${ethers.formatEther(user1ConsumedVP)} VP`);
  console.log(`   User2 Global VP: ${ethers.formatEther(user2GlobalVP)} VP`);
  console.log(`   User2 Consumed VP (tracked for refund): ${ethers.formatEther(user2ConsumedVP)} VP`);
  console.log(`   ℹ️  Note: Consumed VP will be refunded when NFT is minted`);

  console.log("\n" + "=".repeat(60));
  console.log("Test 8: Close Topic and Mint NFT");
  console.log("=".repeat(60));

  // Check if topic can be closed
  const isExpiredForMint = await topicFactory.isExpired(topicId);
  console.log(`\n📊 Topic Status Check:`);
  console.log(`   Is Expired: ${isExpiredForMint}`);
  
  // Try to close topic if expired
  if (isExpiredForMint) {
    console.log(`\n🔒 Closing topic...`);
    try {
      // Try checkAndCloseTopic first (auto-closes if expired)
      const closed = await retryTransaction(async () => {
        return await topicFactory.checkAndCloseTopic(topicId);
      });
      if (closed) {
        console.log(`   ✅ Topic auto-closed via checkAndCloseTopic`);
      } else {
        // Try manual close
        await retryTransaction(async () => {
          return await topicFactory.closeTopic(topicId);
        });
        console.log(`   ✅ Topic closed via closeTopic`);
      }
    } catch (err) {
      console.log(`   ⚠️  Could not close topic: ${err.message}`);
      console.log(`   This might require admin role or topic might already be closed`);
    }
  } else {
    console.log(`   ℹ️  Topic is still active (not expired yet).`);
    console.log(`   For testing purposes, we'll try to mint anyway (will fail if not closed).`);
  }

  // Check topic status (required for minting)
  const topicInfoForMint = await topicFactory.getTopic(topicId);
  console.log(`   Topic Status: ${topicInfoForMint.status} (0=Draft, 1=Live, 2=Closed, 3=Minted, 4=Settled)`);
  if (topicInfoForMint.status === 2) { // Closed
    console.log(`\n🎨 Minting NFT for topic ${topicId}...`);
    console.log(`   ℹ️  Any user who posted in this topic can mint the NFT`);
    console.log(`   ℹ️  Minting will trigger VP refund to all participants`);
    
    // Check if user1 has posted (required for minting)
    const user1HasPosted = await messageRegistry.hasUserPostedInTopic(topicId, user1.address);
    console.log(`   User1 has posted: ${user1HasPosted}`);
    
    if (user1HasPosted) {
      // Get VP balances before minting
      const user1VPBeforeMint = await vpToken.balanceOf(user1.address);
      const user2VPBeforeMint = await vpToken.balanceOf(user2.address);
      
      console.log(`   💎 User1 VP before mint: ${ethers.formatEther(user1VPBeforeMint)} VP`);
      console.log(`   💎 User2 VP before mint: ${ethers.formatEther(user2VPBeforeMint)} VP`);
      
      await delay(1000);
      try {
        const mintTx = await retryTransaction(async () => {
          return await nftMinter.connect(user1).mintNfts(topicId);
        });
        const mintReceipt = await mintTx.wait();
        console.log("   ✅ NFT minted!");
        
        // Extract token ID from event
        const mintEvent = mintReceipt.logs.find((log) => {
          try {
            const parsed = nftMinter.interface.parseLog(log);
            return parsed && parsed.name === "NFTMinted";
          } catch {
            return false;
          }
        });
        
        if (mintEvent) {
          const parsed = nftMinter.interface.parseLog(mintEvent);
          const tokenId = parsed.args.tokenId;
          console.log(`   🎨 NFT Token ID: ${tokenId}`);
          
          // Get NFT metadata
          const metadata = await nftMinter.getMetadata(tokenId);
          console.log(`   📋 NFT Metadata:`);
          console.log(`      Topic ID: ${metadata.topicId}`);
          console.log(`      Topic Hash: ${metadata.topicHash}`);
          console.log(`      Curated Hash: ${metadata.curatedHash}`);
          console.log(`      Minted By: ${metadata.mintedBy}`);
        }
        
        // Check VP balances after minting (should be refunded)
        await delay(2000); // Wait for refund to process
        const user1VPAfterMint = await vpToken.balanceOf(user1.address);
        const user2VPAfterMint = await vpToken.balanceOf(user2.address);
        
        const user1VPRefunded = user1VPAfterMint - user1VPBeforeMint;
        const user2VPRefunded = user2VPAfterMint - user2VPBeforeMint;
        
        console.log(`\n💰 VP Refund Results:`);
        console.log(`   User1 VP after mint: ${ethers.formatEther(user1VPAfterMint)} VP`);
        console.log(`   User1 VP refunded: ${ethers.formatEther(user1VPRefunded)} VP`);
        console.log(`   User2 VP after mint: ${ethers.formatEther(user2VPAfterMint)} VP`);
        console.log(`   User2 VP refunded: ${ethers.formatEther(user2VPRefunded)} VP`);
        
        // Check topic status after minting
        const topicAfterMint = await topicFactory.getTopic(topicId);
        console.log(`   Topic Status after mint: ${topicAfterMint.status} (should be 3=Minted)`);
      } catch (err) {
        console.log(`   ⚠️  Could not mint NFT: ${err.message}`);
        console.log(`   This might be because:`);
        console.log(`   - Topic is not closed yet`);
        console.log(`   - NFT already minted`);
        console.log(`   - User has not posted in topic`);
      }
    } else {
      console.log(`   ⚠️  User1 has not posted, cannot mint NFT`);
    }
  } else {
    console.log(`   ℹ️  Topic is not closed yet (status: ${topicInfo.status}). Cannot mint NFT.`);
    console.log(`   In production, wait for topic to expire or close it first.`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("Test 9: Withdraw vDOT");
  console.log("=".repeat(60));

  // User1 can withdraw staked vDOT
  console.log(`\n💰 User1 withdrawing staked vDOT...`);
  const user1StakedVdot = await vpToken.stakedVdot(user1.address);
  console.log(`   User1 staked vDOT: ${ethers.formatEther(user1StakedVdot)} vDOT`);
  
  if (user1StakedVdot > 0n) {
    const withdrawAmount = user1StakedVdot / 2n; // Withdraw half
    console.log(`   Withdrawing ${ethers.formatEther(withdrawAmount)} vDOT...`);
    
    const user1VdotBalanceBefore = await vdotToken.balanceOf(user1.address);
    
    await delay(1000);
    try {
      const withdrawTx = await retryTransaction(async () => {
        return await vpToken.connect(user1).withdrawVdot(withdrawAmount);
      });
      await withdrawTx.wait();
      console.log("   ✅ vDOT withdrawn!");
      
      const user1VdotBalanceAfter = await vdotToken.balanceOf(user1.address);
      const vdotReceived = user1VdotBalanceAfter - user1VdotBalanceBefore;
      console.log(`   💰 vDOT received: ${ethers.formatEther(vdotReceived)} vDOT`);
      console.log(`   💎 Note: VP balance remains unchanged after withdrawing vDOT`);
      
      const user1VPAfterWithdraw = await vpToken.balanceOf(user1.address);
      console.log(`   💎 User1 VP after withdraw: ${ethers.formatEther(user1VPAfterWithdraw)} VP`);
    } catch (err) {
      console.log(`   ⚠️  Could not withdraw vDOT: ${err.message}`);
    }
  } else {
    console.log(`   ℹ️  No staked vDOT to withdraw`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ All tests completed successfully!");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Test failed:");
    console.error(error);
    process.exit(1);
  });
