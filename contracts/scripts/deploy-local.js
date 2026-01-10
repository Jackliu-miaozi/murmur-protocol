const hre = require("hardhat");

/**
 * 本地部署脚本 - 自动部署 vDOT Token 和所有 Murmur Protocol 合约
 * 
 * 使用方法:
 *   npx hardhat run scripts/deploy-local.js --network localNode
 *   或
 *   npx hardhat run scripts/deploy-local.js --network hardhat
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("🚀 Starting local deployment...");
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());
  console.log("");

  // Step 1: Deploy VDOT Token
  console.log("=".repeat(60));
  console.log("Step 1: Deploying VDOTToken");
  console.log("=".repeat(60));
  const VDOTToken = await hre.ethers.getContractFactory("VDOTToken");
  const vdotToken = await VDOTToken.deploy(deployer.address);
  await vdotToken.waitForDeployment();
  const vdotTokenAddress = await vdotToken.getAddress();
  console.log("✅ VDOTToken deployed to:", vdotTokenAddress);
  console.log("   Token name:", await vdotToken.name());
  console.log("   Token symbol:", await vdotToken.symbol());
  console.log("");

  // Use deployer address as AI Verifier for local testing
  const aiVerifierAddress = deployer.address;
  console.log("📋 Using deployer address as AI Verifier:", aiVerifierAddress);
  console.log("");

  // Step 2: Deploy all Murmur Protocol contracts
  console.log("=".repeat(60));
  console.log("Step 2: Deploying Murmur Protocol Contracts");
  console.log("=".repeat(60));
  console.log("");

  console.log("=== Phase 1: Deploy Independent Contracts ===\n");

  // 1. Deploy VPToken
  console.log("1️⃣  Deploying VPToken...");
  const VPToken = await hre.ethers.getContractFactory("VPToken");
  const vpToken = await VPToken.deploy(vdotTokenAddress, deployer.address);
  await vpToken.waitForDeployment();
  const vpTokenAddress = await vpToken.getAddress();
  console.log("   ✅ VPToken deployed to:", vpTokenAddress);

  // 2. Deploy AIScoreVerifier
  console.log("2️⃣  Deploying AIScoreVerifier...");
  const AIScoreVerifier = await hre.ethers.getContractFactory("AIScoreVerifier");
  const aiScoreVerifier = await AIScoreVerifier.deploy(aiVerifierAddress, deployer.address);
  await aiScoreVerifier.waitForDeployment();
  const aiScoreVerifierAddress = await aiScoreVerifier.getAddress();
  console.log("   ✅ AIScoreVerifier deployed to:", aiScoreVerifierAddress);

  // 3. Deploy TopicFactory
  console.log("3️⃣  Deploying TopicFactory...");
  const TopicFactory = await hre.ethers.getContractFactory("TopicFactory");
  const topicFactory = await TopicFactory.deploy(vpTokenAddress, deployer.address);
  await topicFactory.waitForDeployment();
  const topicFactoryAddress = await topicFactory.getAddress();
  console.log("   ✅ TopicFactory deployed to:", topicFactoryAddress);

  // 4. Deploy TopicVault
  console.log("4️⃣  Deploying TopicVault...");
  const TopicVault = await hre.ethers.getContractFactory("TopicVault");
  const topicVault = await TopicVault.deploy(topicFactoryAddress, vpTokenAddress, deployer.address);
  await topicVault.waitForDeployment();
  const topicVaultAddress = await topicVault.getAddress();
  console.log("   ✅ TopicVault deployed to:", topicVaultAddress);

  console.log("\n=== Phase 2: Deploy Contracts with Circular Dependency (Using Placeholder) ===\n");

  // 5. Deploy placeholder CurationModule first (using deployer address as temporary MessageRegistry)
  console.log("5️⃣  Deploying placeholder CurationModule...");
  const CurationModule = await hre.ethers.getContractFactory("CurationModule");
  const placeholderCuration = await CurationModule.deploy(
    topicFactoryAddress,
    deployer.address, // placeholder MessageRegistry address
    deployer.address
  );
  await placeholderCuration.waitForDeployment();
  const placeholderCurationAddress = await placeholderCuration.getAddress();
  console.log("   📌 Placeholder CurationModule deployed to:", placeholderCurationAddress);

  // 6. Deploy MessageRegistry with placeholder CurationModule
  console.log("6️⃣  Deploying MessageRegistry with placeholder CurationModule...");
  const MessageRegistry = await hre.ethers.getContractFactory("MessageRegistry");
  const messageRegistry = await MessageRegistry.deploy(
    topicFactoryAddress,
    topicVaultAddress,
    aiScoreVerifierAddress,
    placeholderCurationAddress,
    deployer.address
  );
  await messageRegistry.waitForDeployment();
  const tempMessageRegistryAddress = await messageRegistry.getAddress();
  console.log("   ✅ Temporary MessageRegistry deployed to:", tempMessageRegistryAddress);

  // 7. Deploy real CurationModule with temporary MessageRegistry
  console.log("7️⃣  Deploying real CurationModule with temporary MessageRegistry...");
  const realCurationModule = await CurationModule.deploy(
    topicFactoryAddress,
    tempMessageRegistryAddress,
    deployer.address
  );
  await realCurationModule.waitForDeployment();
  const curationModuleAddress = await realCurationModule.getAddress();
  console.log("   ✅ Real CurationModule deployed to:", curationModuleAddress);

  // 8. Redeploy MessageRegistry with real CurationModule
  console.log("8️⃣  Redeploying MessageRegistry with real CurationModule...");
  const finalMessageRegistry = await MessageRegistry.deploy(
    topicFactoryAddress,
    topicVaultAddress,
    aiScoreVerifierAddress,
    curationModuleAddress,
    deployer.address
  );
  await finalMessageRegistry.waitForDeployment();
  const messageRegistryAddress = await finalMessageRegistry.getAddress();
  console.log("   ✅ Final MessageRegistry deployed to:", messageRegistryAddress);

  console.log("\n=== Phase 3: Configure Contracts ===\n");

  // 9. Set MessageRegistry in TopicVault
  console.log("9️⃣  Setting MessageRegistry in TopicVault...");
  const setRegistryTx = await topicVault.setMessageRegistry(messageRegistryAddress);
  await setRegistryTx.wait();
  console.log("   ✅ MessageRegistry set");

  // 10. Grant VPToken roles
  console.log("🔟 Granting VPToken roles...");
  const BURNER_ROLE = await vpToken.BURNER_ROLE();
  const MINTER_ROLE = await vpToken.MINTER_ROLE();
  
  const grantBurnerTx = await vpToken.grantRole(BURNER_ROLE, topicFactoryAddress);
  await grantBurnerTx.wait();
  console.log("   ✅ BURNER_ROLE granted to TopicFactory");
  
  const grantVaultBurnerTx = await vpToken.grantRole(BURNER_ROLE, topicVaultAddress);
  await grantVaultBurnerTx.wait();
  console.log("   ✅ BURNER_ROLE granted to TopicVault (for lockVdot)");
  
  const grantMinterTx = await vpToken.grantRole(MINTER_ROLE, topicVaultAddress);
  await grantMinterTx.wait();
  console.log("   ✅ MINTER_ROLE granted to TopicVault");

  // 11. Grant TopicFactory roles
  console.log("1️⃣1️⃣ Granting TopicFactory roles...");
  const OPERATOR_ROLE = await topicFactory.OPERATOR_ROLE();
  
  const grantOpMsgTx = await topicFactory.grantRole(OPERATOR_ROLE, messageRegistryAddress);
  await grantOpMsgTx.wait();
  console.log("   ✅ OPERATOR_ROLE granted to MessageRegistry");
  
  const grantOpVaultTx = await topicFactory.grantRole(OPERATOR_ROLE, topicVaultAddress);
  await grantOpVaultTx.wait();
  console.log("   ✅ OPERATOR_ROLE granted to TopicVault");

  console.log("\n=== Phase 4: Deploy NFTMinter ===\n");

  // 12. Deploy NFTMinter
  console.log("1️⃣2️⃣ Deploying NFTMinter...");
  const NFTMinter = await hre.ethers.getContractFactory("NFTMinter");
  const nftMinter = await NFTMinter.deploy(
    topicFactoryAddress,
    curationModuleAddress,
    messageRegistryAddress,
    topicVaultAddress,
    deployer.address
  );
  await nftMinter.waitForDeployment();
  const nftMinterAddress = await nftMinter.getAddress();
  console.log("   ✅ NFTMinter deployed to:", nftMinterAddress);

  // 13. Grant remaining roles
  console.log("1️⃣3️⃣ Granting remaining roles...");
  const NFT_MINTER_ROLE = await topicFactory.NFT_MINTER_ROLE();
  const grantNftMinterTx = await topicFactory.grantRole(NFT_MINTER_ROLE, nftMinterAddress);
  await grantNftMinterTx.wait();
  console.log("   ✅ NFT_MINTER_ROLE granted to NFTMinter");

  const curationModule = await hre.ethers.getContractAt("CurationModule", curationModuleAddress);
  const curationOperatorRole = await curationModule.OPERATOR_ROLE();
  const grantCurationOpTx = await curationModule.grantRole(curationOperatorRole, nftMinterAddress);
  await grantCurationOpTx.wait();
  console.log("   ✅ OPERATOR_ROLE granted to NFTMinter in CurationModule");

  const vaultOperatorRole = await topicVault.OPERATOR_ROLE();
  const grantVaultOpTx = await topicVault.grantRole(vaultOperatorRole, nftMinterAddress);
  await grantVaultOpTx.wait();
  console.log("   ✅ OPERATOR_ROLE granted to NFTMinter in TopicVault");

  console.log("\n" + "=".repeat(60));
  console.log("🎉 Local Deployment Complete!");
  console.log("=".repeat(60));
  console.log("\n📝 Contract Addresses:");
  console.log("─".repeat(60));
  console.log("VDOTToken:         ", vdotTokenAddress);
  console.log("VPToken:           ", vpTokenAddress);
  console.log("AIScoreVerifier:   ", aiScoreVerifierAddress);
  console.log("TopicFactory:      ", topicFactoryAddress);
  console.log("TopicVault:       ", topicVaultAddress);
  console.log("CurationModule:   ", curationModuleAddress);
  console.log("MessageRegistry:  ", messageRegistryAddress);
  console.log("NFTMinter:        ", nftMinterAddress);
  console.log("─".repeat(60));
  console.log("\n⚠️  Note: Placeholder contracts were used and then replaced.");
  console.log("   Placeholder CurationModule:", placeholderCurationAddress);
  console.log("   Temporary MessageRegistry:", tempMessageRegistryAddress);
  console.log("\n💾 All contracts deployed successfully to local network!");
  console.log("\n✅ Deployment complete!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
