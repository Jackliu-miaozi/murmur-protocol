const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log(
    "Account balance:",
    (await hre.ethers.provider.getBalance(deployer.address)).toString()
  );

  // 从命令行参数或环境变量获取部署参数
  // 你可以通过环境变量设置，或者直接在这里修改地址
  //
  // ⚠️ 重要：请替换下面的地址为实际地址！
  // 如果使用环境变量，请运行：
  //   export VDOT_TOKEN=0x...
  //   export AI_VERIFIER=0x...
  let vdotTokenAddress =
    process.env.VDOT_TOKEN || "0x0000000000000000000000000000000000000000";
  let aiVerifierAddress =
    process.env.AI_VERIFIER || "0x0000000000000000000000000000000000000000";

  // Check if we're on a local network (hardhat or localNode)
  const network = await hre.ethers.provider.getNetwork();
  const isLocalNetwork =
    network.chainId === 31337n ||
    network.name === "localNode" ||
    network.name === "hardhat";

  // Auto-deploy VDOT Token on local networks if not provided
  if (
    vdotTokenAddress === "0x0000000000000000000000000000000000000000" &&
    isLocalNetwork
  ) {
    console.log("\n📦 Auto-deploying VDOTToken for local network...");
    const VDOTToken = await hre.ethers.getContractFactory("VDOTToken");
    const vdotToken = await VDOTToken.deploy(deployer.address);
    await vdotToken.waitForDeployment();
    vdotTokenAddress = await vdotToken.getAddress();
    console.log("✅ VDOTToken auto-deployed to:", vdotTokenAddress);
    console.log("");
  }

  // Use deployer address as AI Verifier on local networks if not provided
  if (
    aiVerifierAddress === "0x0000000000000000000000000000000000000000" &&
    isLocalNetwork
  ) {
    aiVerifierAddress = deployer.address;
    console.log("📋 Using deployer address as AI Verifier:", aiVerifierAddress);
    console.log("");
  }

  if (
    vdotTokenAddress === "0x0000000000000000000000000000000000000000" ||
    aiVerifierAddress === "0x0000000000000000000000000000000000000000"
  ) {
    console.error("\n❌ Error: Please set deployment parameters!");
    console.error("\n📝 你需要提供以下两个地址：");
    console.error("   1. vDOT Token 地址: vDOT ERC-20 代币合约地址");
    console.error("   2. AI Verifier 地址: AI 服务验证者地址（用于签名验证）");
    console.error("\n💡 设置方法：");
    console.error("   方式 1: 使用环境变量（推荐）");
    console.error("     export VDOT_TOKEN=0x你的vDOT代币地址");
    console.error("     export AI_VERIFIER=0x你的AI验证者地址");
    console.error("     npx hardhat run scripts/deploy.js --network passetHub");
    console.error("\n   方式 2: 直接修改脚本");
    console.error("     编辑 scripts/deploy.js，修改第 10-11 行的默认地址\n");
    process.exit(1);
  }

  console.log("\n📋 Deployment Parameters:");
  console.log("   vDOT Token:", vdotTokenAddress);
  console.log("   AI Verifier:", aiVerifierAddress);
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
  const AIScoreVerifier = await hre.ethers.getContractFactory(
    "AIScoreVerifier"
  );
  const aiScoreVerifier = await AIScoreVerifier.deploy(
    aiVerifierAddress,
    deployer.address
  );
  await aiScoreVerifier.waitForDeployment();
  const aiScoreVerifierAddress = await aiScoreVerifier.getAddress();
  console.log("   ✅ AIScoreVerifier deployed to:", aiScoreVerifierAddress);

  // 3. Deploy TopicFactory
  console.log("3️⃣  Deploying TopicFactory...");
  const TopicFactory = await hre.ethers.getContractFactory("TopicFactory");
  const topicFactory = await TopicFactory.deploy(
    vpTokenAddress,
    deployer.address
  );
  await topicFactory.waitForDeployment();
  const topicFactoryAddress = await topicFactory.getAddress();
  console.log("   ✅ TopicFactory deployed to:", topicFactoryAddress);

  // 4. Deploy TopicVault
  console.log("4️⃣  Deploying TopicVault...");
  const TopicVault = await hre.ethers.getContractFactory("TopicVault");
  const topicVault = await TopicVault.deploy(
    topicFactoryAddress,
    vpTokenAddress,
    deployer.address
  );
  await topicVault.waitForDeployment();
  const topicVaultAddress = await topicVault.getAddress();
  console.log("   ✅ TopicVault deployed to:", topicVaultAddress);

  console.log("\n=== Phase 2: Deploy Contracts with Circular Dependency ===\n");

  let curationModuleAddress;
  let messageRegistryAddress;
  let deploymentHelperAddress = null;

  // Use placeholder method for local networks, DeploymentHelper for testnets
  if (isLocalNetwork) {
    // Use placeholder method (more reliable on Polkadot VM)
    console.log("5️⃣  Deploying placeholder CurationModule...");
    const CurationModule = await hre.ethers.getContractFactory(
      "CurationModule"
    );
    const placeholderCuration = await CurationModule.deploy(
      topicFactoryAddress,
      deployer.address, // placeholder MessageRegistry address
      deployer.address
    );
    await placeholderCuration.waitForDeployment();
    const placeholderCurationAddress = await placeholderCuration.getAddress();
    console.log(
      "   📌 Placeholder CurationModule deployed to:",
      placeholderCurationAddress
    );

    console.log(
      "6️⃣  Deploying MessageRegistry with placeholder CurationModule..."
    );
    const MessageRegistry = await hre.ethers.getContractFactory(
      "MessageRegistry"
    );
    const messageRegistry = await MessageRegistry.deploy(
      topicFactoryAddress,
      topicVaultAddress,
      aiScoreVerifierAddress,
      placeholderCurationAddress,
      deployer.address
    );
    await messageRegistry.waitForDeployment();
    const tempMessageRegistryAddress = await messageRegistry.getAddress();
    console.log(
      "   ✅ Temporary MessageRegistry deployed to:",
      tempMessageRegistryAddress
    );

    console.log(
      "7️⃣  Deploying real CurationModule with temporary MessageRegistry..."
    );
    const realCurationModule = await CurationModule.deploy(
      topicFactoryAddress,
      tempMessageRegistryAddress,
      deployer.address
    );
    await realCurationModule.waitForDeployment();
    curationModuleAddress = await realCurationModule.getAddress();
    console.log(
      "   ✅ Real CurationModule deployed to:",
      curationModuleAddress
    );

    console.log("8️⃣  Redeploying MessageRegistry with real CurationModule...");
    const finalMessageRegistry = await MessageRegistry.deploy(
      topicFactoryAddress,
      topicVaultAddress,
      aiScoreVerifierAddress,
      curationModuleAddress,
      deployer.address
    );
    await finalMessageRegistry.waitForDeployment();
    messageRegistryAddress = await finalMessageRegistry.getAddress();
    console.log(
      "   ✅ Final MessageRegistry deployed to:",
      messageRegistryAddress
    );
  } else {
    // Use DeploymentHelper for testnets
    console.log("5️⃣  Deploying DeploymentHelper...");
    const DeploymentHelper = await hre.ethers.getContractFactory(
      "DeploymentHelper"
    );
    const deploymentHelper = await DeploymentHelper.deploy(
      topicFactoryAddress,
      deployer.address
    );
    await deploymentHelper.waitForDeployment();
    deploymentHelperAddress = await deploymentHelper.getAddress();
    console.log("   ✅ DeploymentHelper deployed to:", deploymentHelperAddress);

    console.log(
      "6️⃣  Deploying CurationModule and MessageRegistry (handling circular dependency)..."
    );
    const curationSalt =
      "0x0000000000000000000000000000000000000000000000000000000000000001";
    const messageSalt =
      "0x0000000000000000000000000000000000000000000000000000000000000002";

    console.log("   ⏳ Calling deployBoth...");
    const deployTx = await deploymentHelper.deployBoth(
      topicVaultAddress,
      aiScoreVerifierAddress,
      curationSalt,
      messageSalt
    );
    console.log("   ⏳ Waiting for transaction confirmation...");
    const receipt = await deployTx.wait();

    // Extract addresses from events
    for (const log of receipt.logs) {
      try {
        const parsed = deploymentHelper.interface.parseLog(log);
        if (parsed && parsed.name === "CurationModuleDeployed") {
          curationModuleAddress = parsed.args[0];
        } else if (parsed && parsed.name === "MessageRegistryDeployed") {
          messageRegistryAddress = parsed.args[0];
        }
      } catch (e) {
        // Not a DeploymentHelper event, skip
      }
    }

    if (!curationModuleAddress || !messageRegistryAddress) {
      throw new Error(
        "Failed to extract contract addresses from deployment events"
      );
    }

    console.log("   ✅ CurationModule deployed to:", curationModuleAddress);
    console.log("   ✅ MessageRegistry deployed to:", messageRegistryAddress);
  }

  console.log("\n=== Phase 3: Configure Contracts ===\n");

  // Set MessageRegistry in TopicVault
  const stepNum = isLocalNetwork ? "9️⃣" : "7️⃣";
  console.log(`${stepNum}  Setting MessageRegistry in TopicVault...`);
  const setRegistryTx = await topicVault.setMessageRegistry(
    messageRegistryAddress
  );
  await setRegistryTx.wait();
  console.log("   ✅ MessageRegistry set");

  // Grant VPToken roles
  const stepNum2 = isLocalNetwork ? "🔟" : "8️⃣";
  console.log(`${stepNum2}  Granting VPToken roles...`);
  const BURNER_ROLE = await vpToken.BURNER_ROLE();
  const MINTER_ROLE = await vpToken.MINTER_ROLE();

  const grantBurnerTx = await vpToken.grantRole(
    BURNER_ROLE,
    topicFactoryAddress
  );
  await grantBurnerTx.wait();
  console.log("   ✅ BURNER_ROLE granted to TopicFactory");

  const grantVaultBurnerTx = await vpToken.grantRole(
    BURNER_ROLE,
    topicVaultAddress
  );
  await grantVaultBurnerTx.wait();
  console.log("   ✅ BURNER_ROLE granted to TopicVault (for lockVdot)");

  const grantMinterTx = await vpToken.grantRole(MINTER_ROLE, topicVaultAddress);
  await grantMinterTx.wait();
  console.log("   ✅ MINTER_ROLE granted to TopicVault");

  // Grant TopicFactory roles
  const stepNum3 = isLocalNetwork ? "1️⃣1️⃣" : "9️⃣";
  console.log(`${stepNum3}  Granting TopicFactory roles...`);
  const OPERATOR_ROLE = await topicFactory.OPERATOR_ROLE();

  const grantOpMsgTx = await topicFactory.grantRole(
    OPERATOR_ROLE,
    messageRegistryAddress
  );
  await grantOpMsgTx.wait();
  console.log("   ✅ OPERATOR_ROLE granted to MessageRegistry");

  const grantOpVaultTx = await topicFactory.grantRole(
    OPERATOR_ROLE,
    topicVaultAddress
  );
  await grantOpVaultTx.wait();
  console.log("   ✅ OPERATOR_ROLE granted to TopicVault");

  console.log("\n=== Phase 4: Deploy NFTMinter ===\n");

  // Deploy NFTMinter
  const stepNum4 = isLocalNetwork ? "1️⃣2️⃣" : "🔟";
  console.log(`${stepNum4}  Deploying NFTMinter...`);
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

  // Grant remaining roles
  const stepNum5 = isLocalNetwork ? "1️⃣3️⃣" : "1️⃣1️⃣";
  console.log(`${stepNum5}  Granting remaining roles...`);
  const NFT_MINTER_ROLE = await topicFactory.NFT_MINTER_ROLE();
  const grantNftMinterTx = await topicFactory.grantRole(
    NFT_MINTER_ROLE,
    nftMinterAddress
  );
  await grantNftMinterTx.wait();
  console.log("   ✅ NFT_MINTER_ROLE granted to NFTMinter");

  const curationModule = await hre.ethers.getContractAt(
    "CurationModule",
    curationModuleAddress
  );
  const curationOperatorRole = await curationModule.OPERATOR_ROLE();
  const grantCurationOpTx = await curationModule.grantRole(
    curationOperatorRole,
    nftMinterAddress
  );
  await grantCurationOpTx.wait();
  console.log("   ✅ OPERATOR_ROLE granted to NFTMinter in CurationModule");

  const vaultOperatorRole = await topicVault.OPERATOR_ROLE();
  const grantVaultOpTx = await topicVault.grantRole(
    vaultOperatorRole,
    nftMinterAddress
  );
  await grantVaultOpTx.wait();
  console.log("   ✅ OPERATOR_ROLE granted to NFTMinter in TopicVault");

  console.log("\n" + "=".repeat(60));
  console.log("🎉 Deployment Complete!");
  console.log("=".repeat(60));
  console.log("\n📝 Contract Addresses:");
  console.log("─".repeat(60));
  console.log("VPToken:           ", vpTokenAddress);
  console.log("AIScoreVerifier:   ", aiScoreVerifierAddress);
  console.log("TopicFactory:       ", topicFactoryAddress);
  console.log("TopicVault:        ", topicVaultAddress);
  console.log("CurationModule:    ", curationModuleAddress);
  console.log("MessageRegistry:    ", messageRegistryAddress);
  console.log("NFTMinter:          ", nftMinterAddress);
  if (deploymentHelperAddress) {
    console.log("DeploymentHelper:   ", deploymentHelperAddress);
  }
  console.log("─".repeat(60));
  console.log("\n💾 Save these addresses for future reference!");
  console.log("\n✅ All contracts deployed and configured successfully!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
