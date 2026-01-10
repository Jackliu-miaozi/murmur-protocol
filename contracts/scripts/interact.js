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
      if (
        errorMsg.includes("temporarily banned") ||
        errorMsg.includes("rate limit")
      ) {
        const waitTime = delayMs * Math.pow(2, i); // Exponential backoff
        console.log(
          `   ⚠️  Transaction rate limited, waiting ${waitTime}ms before retry ${
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
  VPToken: "0x3ed62137c5DB927cb137c26455969116BF0c23Cb",
  AIScoreVerifier: "0x5CC307268a1393AB9A764A20DACE848AB8275c46",
  TopicFactory: "0x21cb3940e6Ba5284E1750F1109131a8E8062b9f1",
  TopicVault: "0x7d4567B7257cf869B01a47E8cf0EDB3814bDb963",
  CurationModule: "0xb6F2B9415fc599130084b7F20B84738aCBB15930",
  MessageRegistry: "0x746DFE0F96789e62CECeeA3CA2a9b5556b3AaD6c",
  NFTMinter: "0xab7785d56697E65c2683c8121Aac93D3A028Ba95",
  VDOTToken:
    process.env.VDOT_TOKEN || "0x0000000000000000000000000000000000000000", // Will be auto-detected or set via env var
};

// Helper function to generate AI signature
// The contract uses a custom EIP-712 implementation, so we match it exactly
async function generateAISignature(
  aiVerifier,
  contentHash,
  length,
  aiScore,
  timestamp,
  signer
) {
  // Get domain separator from contract (it's computed in the contract)
  const domainSeparator = await aiVerifier.DOMAIN_SEPARATOR();

  // TYPE_HASH matches the contract: keccak256("AIScore(bytes32 contentHash,uint256 length,uint256 aiScore,uint256 timestamp)")
  const TYPE_HASH = ethers.keccak256(
    ethers.toUtf8Bytes(
      "AIScore(bytes32 contentHash,uint256 length,uint256 aiScore,uint256 timestamp)"
    )
  );

  // Build struct hash (matches contract's abi.encode)
  const structHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "bytes32", "uint256", "uint256", "uint256"],
      [TYPE_HASH, contentHash, length, aiScore, timestamp]
    )
  );

  // Build EIP-712 hash (matches contract: keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash)))
  // Note: abi.encodePacked concatenates without padding
  // "\x19\x01" as hex string (2 bytes)
  const prefixHex = "0x1901";
  const hash = ethers.keccak256(
    ethers.concat([prefixHex, domainSeparator, structHash])
  );

  // Sign the raw hash (contract uses ECDSA.recover which expects signature of the hash directly)
  // We need to sign without the Ethereum message prefix, so we use signingKey directly
  const hashBytes = ethers.getBytes(hash);
  const signature = signer.signingKey.sign(hashBytes);

  // Build serialized signature: r (32 bytes) + s (32 bytes) + v (1 byte)
  // OpenZeppelin's ECDSA.recover expects v to be 27 (0x1b) or 28 (0x1c)
  const r = signature.r;
  const s = signature.s;
  const v = signature.v; // Already 27 or 28

  // Return serialized signature: r + s + v (65 bytes total)
  return ethers.concat([r, s, ethers.toBeHex(v, 1)]);
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

  // If users don't have balance and we can't fund them, use deployer for all operations
  const minBalance = ethers.parseEther("1");
  if (
    isLocalNetwork &&
    (user1Balance < minBalance || user2Balance < minBalance)
  ) {
    console.log("\n⚠️  User accounts have insufficient balance for gas fees.");
    console.log(
      "   Using deployer account for all operations to avoid funding issues."
    );
    useDeployerForAll = true;
    user1 = deployer;
    user2 = deployer;
  } else if (isLocalNetwork && deployerBalance >= ethers.parseEther("100")) {
    // Try to fund accounts
    const fundAmount = ethers.parseEther("10");
    try {
      if (user1Balance < fundAmount) {
        const fundTx1 = await deployer.sendTransaction({
          to: user1.address,
          value: fundAmount,
          gasLimit: 21000,
        });
        await fundTx1.wait();
        console.log(
          `   ✅ Funded User1 with ${ethers.formatEther(fundAmount)} ETH`
        );
      }
      if (user2Balance < fundAmount) {
        const fundTx2 = await deployer.sendTransaction({
          to: user2.address,
          value: fundAmount,
          gasLimit: 21000,
        });
        await fundTx2.wait();
        console.log(
          `   ✅ Funded User2 with ${ethers.formatEther(fundAmount)} ETH`
        );
      }
    } catch (err) {
      console.log(`   ⚠️  Could not fund accounts: ${err.message}`);
      console.log(`   ⚠️  Using deployer for all operations`);
      useDeployerForAll = true;
      user1 = deployer;
      user2 = deployer;
    }
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

  console.log("   ✅ All contracts connected\n");

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

  // Create topic
  const metadataHash = ethers.keccak256(
    ethers.toUtf8Bytes("Test Topic: Web3 Discussion")
  );
  const topicDuration = 7 * 24 * 60 * 60; // 7 days
  const freezeWindow = 1 * 24 * 60 * 60; // 1 day
  const curatedLimit = 10;

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
  console.log("Test 3: Participate in Topic (Lock vDOT)");
  console.log("=".repeat(60));

  // User2 stakes vDOT first
  console.log("\n💰 User2 staking vDOT to get VP...");
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
  console.log(`   ✅ User2 VP Balance: ${ethers.formatEther(user2VP)} VP`);

  // User2 locks vDOT in topic
  const lockAmount = ethers.parseEther("200");
  console.log(
    `\n🔒 User2 locking ${ethers.formatEther(
      lockAmount
    )} vDOT in topic ${topicId}...`
  );
  await delay(1000); // Add delay before transaction
  const lockTx = await retryTransaction(async () => {
    return await topicVault.connect(user2).lockVdot(topicId, lockAmount);
  });
  await lockTx.wait();
  console.log("   ✅ Lock transaction confirmed");

  // Check topic-scoped VP balance
  const topicVPBalance = await topicVault.balanceOf(topicId, user2.address);
  console.log(
    `   💎 User2 Topic VP Balance: ${ethers.formatEther(topicVPBalance)} VP`
  );

  // User1 also locks some vDOT
  const user1LockAmount = ethers.parseEther("300");
  console.log(
    `\n🔒 User1 locking ${ethers.formatEther(
      user1LockAmount
    )} vDOT in topic ${topicId}...`
  );
  await delay(1000); // Add delay before transaction
  await retryTransaction(async () => {
    return await topicVault.connect(user1).lockVdot(topicId, user1LockAmount);
  });
  const user1TopicVP = await topicVault.balanceOf(topicId, user1.address);
  console.log(
    `   💎 User1 Topic VP Balance: ${ethers.formatEther(user1TopicVP)} VP`
  );

  console.log("\n" + "=".repeat(60));
  console.log("Test 4: Post Messages");
  console.log("=".repeat(60));

  // Post message from User1
  const message1 = "This is my first message in the topic!";
  const contentHash1 = ethers.keccak256(ethers.toUtf8Bytes(message1));
  const length1 = message1.length;
  const aiScore1 = ethers.parseEther("0.7"); // 0.7 intensity
  const timestamp1 = BigInt(Math.floor(Date.now() / 1000));

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

  // Post message
  await delay(2000); // Add delay before posting (respect rate limit of 15 seconds)
  const postTx1 = await retryTransaction(async () => {
    return await messageRegistry
      .connect(user1)
      .postMessage(
        topicId,
        contentHash1,
        length1,
        aiScore1,
        timestamp1,
        signature1
      );
  });
  const postReceipt1 = await postTx1.wait();
  console.log("   ✅ Message posted!");

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
  // Wait 16 seconds for rate limit (MessageRegistry requires 15 seconds between messages)
  console.log("\n⏳ Waiting 16 seconds to respect rate limit...");
  await delay(16000);

  const message2 = "I agree with the discussion!";
  const contentHash2 = ethers.keccak256(ethers.toUtf8Bytes(message2));
  const length2 = message2.length;
  const aiScore2 = ethers.parseEther("0.5");
  const timestamp2 = BigInt(Math.floor(Date.now() / 1000));

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

  const postTx2 = await retryTransaction(async () => {
    return await messageRegistry
      .connect(user2)
      .postMessage(
        topicId,
        contentHash2,
        length2,
        aiScore2,
        timestamp2,
        signature2
      );
  });
  await postTx2.wait();
  console.log("   ✅ Message posted!");

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
    console.log(`\n👍 User2 liking message ${messageId1}...`);
    await delay(1000); // Add delay before transaction
    const likeTx = await retryTransaction(async () => {
      return await messageRegistry
        .connect(user2)
        .likeMessage(topicId, messageId1);
    });
    await likeTx.wait();
    console.log("   ✅ Message liked!");

    // Check like count
    const message1Info = await messageRegistry.messages(messageId1);
    console.log(`   💖 New Like Count: ${message1Info.likeCount}`);
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

  // Get topic messages
  const topicMessages = await messageRegistry.topicMessages(topicId);
  console.log(`   Total Messages: ${topicMessages.length}`);

  // Get topic statistics
  const topicMessageCount = await messageRegistry.topicMessageCount(topicId);
  const topicUniqueUserCount = await messageRegistry.topicUniqueUserCount(
    topicId
  );
  console.log(`   Message Count: ${topicMessageCount}`);
  console.log(`   Unique Users: ${topicUniqueUserCount}`);

  console.log("\n" + "=".repeat(60));
  console.log("Test 7: Check Balances");
  console.log("=".repeat(60));

  const user1GlobalVP = await vpToken.balanceOf(user1.address);
  const user1TopicVPFinal = await topicVault.balanceOf(topicId, user1.address);
  const user2GlobalVP = await vpToken.balanceOf(user2.address);
  const user2TopicVPFinal = await topicVault.balanceOf(topicId, user2.address);

  console.log("\n💰 Final Balances:");
  console.log(`   User1 Global VP: ${ethers.formatEther(user1GlobalVP)} VP`);
  console.log(`   User1 Topic VP: ${ethers.formatEther(user1TopicVPFinal)} VP`);
  console.log(`   User2 Global VP: ${ethers.formatEther(user2GlobalVP)} VP`);
  console.log(`   User2 Topic VP: ${ethers.formatEther(user2TopicVPFinal)} VP`);

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
