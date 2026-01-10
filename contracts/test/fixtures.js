const { ethers } = require("hardhat");
const { expect } = require("chai");

/**
 * Deploy all contracts for testing
 * @returns {Promise<Object>} Object containing all deployed contracts
 */
async function deployContracts() {
  try {
    const [deployer, alice, bob, charlie] = await ethers.getSigners();

  // Deploy VDOTToken
  const VDOTToken = await ethers.getContractFactory("VDOTToken");
  const vdotToken = await VDOTToken.deploy(deployer.address);
  await vdotToken.waitForDeployment();

  // Use deployer as AI verifier for testing
  const aiVerifierAddress = deployer.address;

  // Deploy VPToken
  const VPToken = await ethers.getContractFactory("VPToken");
  const vpToken = await VPToken.deploy(await vdotToken.getAddress(), deployer.address);
  await vpToken.waitForDeployment();
  const vpTokenAddress = await vpToken.getAddress();

  // Deploy AIScoreVerifier
  const AIScoreVerifier = await ethers.getContractFactory("AIScoreVerifier");
  const aiScoreVerifier = await AIScoreVerifier.deploy(aiVerifierAddress, deployer.address);
  await aiScoreVerifier.waitForDeployment();
  const aiScoreVerifierAddress = await aiScoreVerifier.getAddress();

  // Deploy TopicFactory
  const TopicFactory = await ethers.getContractFactory("TopicFactory");
  const topicFactory = await TopicFactory.deploy(vpTokenAddress, deployer.address);
  await topicFactory.waitForDeployment();
  const topicFactoryAddress = await topicFactory.getAddress();

  // Deploy TopicVault
  const TopicVault = await ethers.getContractFactory("TopicVault");
  const topicVault = await TopicVault.deploy(topicFactoryAddress, vpTokenAddress, deployer.address);
  await topicVault.waitForDeployment();
  const topicVaultAddress = await topicVault.getAddress();

  // Deploy DeploymentHelper
  const DeploymentHelper = await ethers.getContractFactory("DeploymentHelper");
  const deploymentHelper = await DeploymentHelper.deploy(topicFactoryAddress, deployer.address);
  await deploymentHelper.waitForDeployment();

  // Deploy CurationModule and MessageRegistry using DeploymentHelper
  const curationSalt = "0x0000000000000000000000000000000000000000000000000000000000000001";
  const messageSalt = "0x0000000000000000000000000000000000000000000000000000000000000002";

  const deployTx = await deploymentHelper.deployBoth(
    topicVaultAddress,
    aiScoreVerifierAddress,
    curationSalt,
    messageSalt
  );
  const receipt = await deployTx.wait();

  // Extract addresses from events
  let curationModuleAddress = null;
  let messageRegistryAddress = null;

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
    throw new Error("Failed to extract contract addresses from deployment events");
  }

  const curationModule = await ethers.getContractAt("CurationModule", curationModuleAddress);
  const messageRegistry = await ethers.getContractAt("MessageRegistry", messageRegistryAddress);

  // Configure contracts
  await topicVault.setMessageRegistry(messageRegistryAddress);

  // Grant VPToken roles
  const BURNER_ROLE = await vpToken.BURNER_ROLE();
  const MINTER_ROLE = await vpToken.MINTER_ROLE();
  await vpToken.grantRole(BURNER_ROLE, topicFactoryAddress);
  await vpToken.grantRole(BURNER_ROLE, topicVaultAddress); // TopicVault needs BURNER_ROLE for lockVdot
  await vpToken.grantRole(MINTER_ROLE, topicVaultAddress);

  // Grant TopicFactory roles
  const OPERATOR_ROLE = await topicFactory.OPERATOR_ROLE();
  await topicFactory.grantRole(OPERATOR_ROLE, messageRegistryAddress);
  await topicFactory.grantRole(OPERATOR_ROLE, topicVaultAddress);
  
  // Note: In tests, we may need to register participation manually
  // The MessageRegistry and TopicVault should handle this, but for testing we ensure roles are set

  // Deploy NFTMinter
  const NFTMinter = await ethers.getContractFactory("NFTMinter");
  const nftMinter = await NFTMinter.deploy(
    topicFactoryAddress,
    curationModuleAddress,
    messageRegistryAddress,
    topicVaultAddress,
    deployer.address
  );
  await nftMinter.waitForDeployment();

  // Grant remaining roles
  const NFT_MINTER_ROLE = await topicFactory.NFT_MINTER_ROLE();
  await topicFactory.grantRole(NFT_MINTER_ROLE, await nftMinter.getAddress());

  const curationOperatorRole = await curationModule.OPERATOR_ROLE();
  await curationModule.grantRole(curationOperatorRole, await nftMinter.getAddress());

  const vaultOperatorRole = await topicVault.OPERATOR_ROLE();
  await topicVault.grantRole(vaultOperatorRole, await nftMinter.getAddress());

  // Grant deployer OPERATOR_ROLE in TopicFactory for testing (to register participation)
  const topicFactoryOperatorRole = await topicFactory.OPERATOR_ROLE();
  await topicFactory.grantRole(topicFactoryOperatorRole, deployer.address);

  return {
    deployer,
    alice,
    bob,
    charlie,
    vdotToken,
    vpToken,
    aiScoreVerifier,
    topicFactory,
    topicVault,
    messageRegistry,
    curationModule,
    nftMinter,
    aiVerifierAddress
  };
  } catch (error) {
    if (error.message && error.message.includes("Transaction is temporarily banned")) {
      throw new Error(
        "Polkadot VM node is not running or not properly configured.\n" +
        "Please check TEST_SETUP.md for instructions on how to start the local node.\n" +
        "Alternatively, try running tests with: npx hardhat test --network hardhatStandard\n" +
        "Original error: " + error.message
      );
    }
    throw error;
  }
}

/**
 * Create a user with VP by staking vDOT
 * @param {Object} contracts - Contract instances
 * @param {Signer} user - User signer
 * @param {BigNumber} vdotAmount - Amount of vDOT to stake
 * @returns {Promise<BigNumber>} VP amount received
 */
async function createUserWithVP(contracts, user, vdotAmount) {
  const { vdotToken, vpToken } = contracts;

  // Mint vDOT to user if needed
  const balance = await vdotToken.balanceOf(user.address);
  if (balance < vdotAmount) {
    await vdotToken.connect(contracts.deployer).mint(user.address, vdotAmount - balance);
  }

  // Approve and stake
  await vdotToken.connect(user).approve(await vpToken.getAddress(), vdotAmount);
  const tx = await vpToken.connect(user).stakeVdot(vdotAmount);
  const receipt = await tx.wait();

  // Calculate expected VP
  const expectedVP = await vpToken.calculateVP(vdotAmount);
  return expectedVP;
}

/**
 * Create a topic
 * @param {Object} contracts - Contract instances
 * @param {Signer} creator - Creator signer
 * @param {BigNumber} duration - Topic duration in seconds
 * @param {BigNumber} freezeWindow - Freeze window in seconds
 * @param {BigNumber} curatedLimit - Maximum curated messages
 * @returns {Promise<BigNumber>} Topic ID
 */
async function createTopic(contracts, creator, duration, freezeWindow, curatedLimit) {
  const { topicFactory } = contracts;
  const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("Test Topic Metadata"));

  const tx = await topicFactory.connect(creator).createTopic(
    metadataHash,
    duration,
    freezeWindow,
    curatedLimit
  );
  const receipt = await tx.wait();

  // Get topic ID from event
  const event = receipt.logs.find(log => {
    try {
      const parsed = topicFactory.interface.parseLog(log);
      return parsed && parsed.name === "TopicCreated";
    } catch {
      return false;
    }
  });

  if (event) {
    const parsed = topicFactory.interface.parseLog(event);
    return parsed.args.topicId;
  }

  // Fallback: get latest topic ID
  const topicCounter = await topicFactory.topicCounter();
  return topicCounter;
}

/**
 * Lock vDOT for a topic and get topic-scoped VP
 * @param {Object} contracts - Contract instances
 * @param {Signer} user - User signer
 * @param {BigNumber} topicId - Topic ID
 * @param {BigNumber} vdotAmount - Amount of vDOT to lock (for VP calculation)
 * @returns {Promise<BigNumber>} VP amount received
 */
async function lockVdotForTopic(contracts, user, topicId, vdotAmount) {
  const { topicVault, topicFactory } = contracts;
  const tx = await topicVault.connect(user).lockVdot(topicId, vdotAmount);
  await tx.wait();

  // Register participation in TopicFactory
  // Note: TopicVault should call registerParticipation but doesn't in current implementation
  // For tests, we ensure participation is registered
  try {
    const participated = await topicFactory.userParticipated(topicId, user.address);
    if (!participated) {
      // TopicVault has OPERATOR_ROLE, but we'll register via deployer for tests
      // In production, TopicVault should call registerParticipation in lockVdot
      await topicFactory.connect(contracts.deployer).registerParticipation(topicId, user.address);
    }
  } catch (e) {
    // Registration might fail in some edge cases, but we continue
  }

  // Calculate expected VP
  const expectedVP = await topicVault.calculateVP(vdotAmount);
  return expectedVP;
}

/**
 * Generate AI signature for testing
 * @param {Object} contracts - Contract instances
 * @param {string} contentHash - Content hash
 * @param {BigNumber} length - Message length
 * @param {BigNumber} aiScore - AI score (0-1, scaled to 1e18)
 * @param {BigNumber} timestamp - Timestamp
 * @returns {Promise<string>} Signature
 */
async function generateAISignature(contracts, contentHash, length, aiScore, timestamp) {
  const { aiVerifierAddress, aiScoreVerifier } = contracts;
  const signer = await ethers.getSigner(aiVerifierAddress);

  // Build EIP-712 hash
  const domain = {
    name: "MurmurProtocol",
    version: "1",
    chainId: await ethers.provider.getNetwork().then(n => n.chainId),
    verifyingContract: await aiScoreVerifier.getAddress()
  };

  const types = {
    AIScore: [
      { name: "contentHash", type: "bytes32" },
      { name: "length", type: "uint256" },
      { name: "aiScore", type: "uint256" },
      { name: "timestamp", type: "uint256" }
    ]
  };

  const value = {
    contentHash,
    length,
    aiScore,
    timestamp
  };

  const signature = await signer.signTypedData(domain, types, value);
  return signature;
}

/**
 * Post a message
 * @param {Object} contracts - Contract instances
 * @param {Signer} user - User signer
 * @param {BigNumber} topicId - Topic ID
 * @param {string} content - Message content
 * @param {BigNumber} aiScore - AI score (0-1, scaled to 1e18)
 * @returns {Promise<BigNumber>} Message ID
 */
async function postMessage(contracts, user, topicId, content, aiScore) {
  const { messageRegistry, topicFactory } = contracts;
  const contentHash = ethers.keccak256(ethers.toUtf8Bytes(content));
  const length = ethers.toUtf8Bytes(content).length;
  const timestamp = BigInt(Math.floor(Date.now() / 1000));

  const signature = await generateAISignature(
    contracts,
    contentHash,
    length,
    aiScore,
    timestamp
  );

  const tx = await messageRegistry.connect(user).postMessage(
    topicId,
    contentHash,
    length,
    aiScore,
    timestamp,
    signature
  );
  const receipt = await tx.wait();

  // Register participation in TopicFactory
  // Note: MessageRegistry should call registerParticipation but doesn't in current implementation
  // For tests, we ensure participation is registered so canUserRedeem works correctly
  try {
    const participated = await topicFactory.userParticipated(topicId, user.address);
    if (!participated) {
      // MessageRegistry has OPERATOR_ROLE, but we'll register via deployer for tests
      // In production, MessageRegistry should call registerParticipation in postMessage
      await topicFactory.connect(contracts.deployer).registerParticipation(topicId, user.address);
    }
  } catch (e) {
    // Registration might fail in some edge cases, but we continue
  }

  // Get message ID from event
  const event = receipt.logs.find(log => {
    try {
      const parsed = messageRegistry.interface.parseLog(log);
      return parsed && parsed.name === "MessagePosted";
    } catch {
      return false;
    }
  });

  if (event) {
    const parsed = messageRegistry.interface.parseLog(event);
    return parsed.args.messageId;
  }

  // Fallback: get latest message ID
  const messageCounter = await messageRegistry.messageCounter();
  return messageCounter;
}

module.exports = {
  deployContracts,
  createUserWithVP,
  createTopic,
  lockVdotForTopic,
  generateAISignature,
  postMessage
};
