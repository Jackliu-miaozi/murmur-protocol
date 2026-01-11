const hre = require("hardhat");
const { ethers } = hre;

// Contract addresses from deployment
const CONTRACT_ADDRESSES = {
  VPToken: "0xF0e46847c8bFD122C4b5EEE1D4494FF7C5FC5104",
  AIScoreVerifier: "0xb91C2eeaA0c475115069a6ED4bc601337a22788E",
  TopicFactory: "0xD45E290062Bd0D1C640D59C350cA03CC291b37FA",
  TopicVault: "0x115f277e8fcE437B1F513A293057D2E396Ac2EC1",
  CurationModule: "0xC530e4cD4933357da902577E78cC7C65C5759e0C",
  MessageRegistry: "0x07aa061c3d7E291348Ea2Df3C33ccFe61c926AcB",
  NFTMinter: "0x6CAa59f27B0b3b5Adc07a2b3EcB7142B3C74f424",
  VDOTToken: "0x0000000000000000000000000000000000000000", // Will be detected
};

// Address to check
const TARGET_ADDRESS = "0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac";

// ERC20 ABI (minimal - just balanceOf)
const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
];

// ERC1155 ABI (for VP Token)
const ERC1155_ABI = [
  {
    constant: true,
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    type: "function",
  },
];

// ERC721 ABI (for NFT)
const ERC721_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    type: "function",
  },
];

async function checkBalance() {
  console.log("🔍 Checking assets for address:", TARGET_ADDRESS);
  console.log("=".repeat(60));

  const provider = hre.ethers.provider;
  const network = await provider.getNetwork();
  console.log(`📡 Network: ${network.name} (Chain ID: ${network.chainId})\n`);

  // 1. Check native token balance (ETH/DOT)
  try {
    const nativeBalance = await provider.getBalance(TARGET_ADDRESS);
    console.log("💰 Native Token Balance:");
    console.log(`   ${hre.ethers.formatEther(nativeBalance)} ETH/DOT`);
    console.log(`   (${nativeBalance.toString()} wei)\n`);
  } catch (error) {
    console.log("❌ Failed to get native balance:", error.message);
  }

  // 2. Check vDOT Token balance
  console.log("🪙 vDOT Token Balance:");
  try {
    // Try to find VDOTToken address if not set
    let vdotAddress = CONTRACT_ADDRESSES.VDOTToken;
    let detectionFailed = false;

    if (vdotAddress === "0x0000000000000000000000000000000000000000") {
      // Try to get from VPToken contract
      console.log(
        "   🔍 Attempting to detect VDOTToken address from VPToken contract..."
      );
      try {
        const vpToken = await hre.ethers.getContractAt(
          "VPToken",
          CONTRACT_ADDRESSES.VPToken
        );
        vdotAddress = await vpToken.vdotToken();
        console.log(`   ✅ Detected VDOTToken address: ${vdotAddress}`);
      } catch (e) {
        console.log(
          `   ⚠️  Could not auto-detect VDOTToken address: ${e.message}`
        );
        detectionFailed = true;
      }
    } else {
      console.log(`   📝 Using provided VDOTToken address: ${vdotAddress}`);
    }

    if (
      !detectionFailed &&
      vdotAddress &&
      vdotAddress !== "0x0000000000000000000000000000000000000000"
    ) {
      try {
        const vdotContract = new hre.ethers.Contract(
          vdotAddress,
          ERC20_ABI,
          provider
        );
        const vdotBalance = await vdotContract.balanceOf(TARGET_ADDRESS);
        const symbol = await vdotContract.symbol();
        const decimals = await vdotContract.decimals();
        const formattedBalance = hre.ethers.formatUnits(vdotBalance, decimals);

        console.log(`   Balance: ${formattedBalance} ${symbol}`);
        console.log(`   (${vdotBalance.toString()} wei)`);
        console.log(`   Contract: ${vdotAddress}\n`);
      } catch (e) {
        console.log(`   ❌ Failed to query balance: ${e.message}`);
        console.log(`   Contract address: ${vdotAddress}\n`);
      }
    } else {
      console.log(
        "   ⚠️  VDOTToken address not available - cannot check balance"
      );
      console.log("   (Address is zero or detection failed)\n");
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  // 3. Check VP Token balance (ERC1155)
  try {
    const vpTokenContract = new hre.ethers.Contract(
      CONTRACT_ADDRESSES.VPToken,
      ERC1155_ABI,
      provider
    );
    const vpBalance = await vpTokenContract.balanceOf(TARGET_ADDRESS, 0); // Token ID 0 for VP
    console.log("💎 VP Token Balance:");
    console.log(`   ${hre.ethers.formatEther(vpBalance)} VP`);
    console.log(`   (${vpBalance.toString()} wei)\n`);

    // Also check staked vDOT
    try {
      const vpTokenFull = await hre.ethers.getContractAt(
        "VPToken",
        CONTRACT_ADDRESSES.VPToken
      );
      const stakedVdot = await vpTokenFull.stakedVdot(TARGET_ADDRESS);
      console.log("🔒 Staked vDOT:");
      console.log(`   ${hre.ethers.formatEther(stakedVdot)} vDOT`);
      console.log(`   (${stakedVdot.toString()} wei)\n`);
    } catch (e) {
      // Ignore if method doesn't exist
    }
  } catch (error) {
    console.log("❌ Failed to get VP balance:", error.message);
  }

  // 4. Check NFT balance
  try {
    const nftContract = new hre.ethers.Contract(
      CONTRACT_ADDRESSES.NFTMinter,
      ERC721_ABI,
      provider
    );
    const nftBalance = await nftContract.balanceOf(TARGET_ADDRESS);
    console.log("🖼️  NFT Balance:");
    console.log(`   ${nftBalance.toString()} Murmur Memory NFTs\n`);

    // If has NFTs, try to get token IDs (this requires additional contract calls)
    if (nftBalance > 0) {
      console.log("   📋 Fetching NFT details...");
      // Note: Getting all token IDs requires additional contract methods
      // This is a simplified version
    }
  } catch (error) {
    console.log("❌ Failed to get NFT balance:", error.message);
  }

  // 5. Check contract interactions (topics created, messages posted, etc.)
  try {
    const topicFactory = await hre.ethers.getContractAt(
      "TopicFactory",
      CONTRACT_ADDRESSES.TopicFactory
    );

    // Get topic counter
    const topicCounter = await topicFactory.topicCounter();
    console.log("📊 Protocol Statistics:");
    console.log(`   Total Topics: ${topicCounter.toString()}\n`);

    // Check if address created any topics (simplified - would need events to get full list)
    console.log("🔍 Checking topic participation...");
    // This would require event filtering - simplified for now
  } catch (error) {
    console.log("❌ Failed to get protocol stats:", error.message);
  }

  // 6. Check MessageRegistry for user activity
  try {
    const messageRegistry = await hre.ethers.getContractAt(
      "MessageRegistry",
      CONTRACT_ADDRESSES.MessageRegistry
    );

    // Get message counter
    const messageCounter = await messageRegistry.messageCounter();
    console.log(`   Total Messages: ${messageCounter.toString()}\n`);
  } catch (error) {
    console.log("❌ Failed to get message stats:", error.message);
  }

  console.log("=".repeat(60));
  console.log("✅ Balance check complete!");
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

async function main() {
  await checkBalance();
}
