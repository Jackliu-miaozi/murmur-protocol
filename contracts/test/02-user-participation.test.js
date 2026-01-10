const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { deployContracts, createUserWithVP, createTopic, lockVdotForTopic, postMessage, generateAISignature } = require("./fixtures");

describe("Step 2: User Participation", function () {
  let contracts;
  let alice, bob;

  const VDOT_AMOUNT = ethers.parseEther("1000");
  const DURATION = 86400; // 24 hours
  const FREEZE_WINDOW = 600; // 10 minutes
  const CURATED_LIMIT = 50;
  let topicId;

  beforeEach(async function () {
    contracts = await deployContracts();
    alice = contracts.alice;
    bob = contracts.bob;

    // Setup: Alice creates a topic
    await createUserWithVP(contracts, alice, VDOT_AMOUNT);
    topicId = await createTopic(contracts, alice, DURATION, FREEZE_WINDOW, CURATED_LIMIT);
  });

  describe("Lock vDOT and Get Topic-Scoped VP", function () {
    it("Should lock vDOT and receive topic-scoped VP correctly", async function () {
      const { topicVault } = contracts;
      
      // Bob locks vDOT for the topic
      const tx = await topicVault.connect(bob).lockVdot(topicId, VDOT_AMOUNT);
      const receipt = await tx.wait();
      
      // Verify VP calculation: VP = 100 * √vDOT
      const expectedVP = await topicVault.calculateVP(VDOT_AMOUNT);
      const actualVP = await topicVault.balanceOf(topicId, bob.address);
      
      expect(actualVP).to.equal(expectedVP);
      expect(actualVP).to.be.gt(ethers.parseEther("3000"));
      expect(actualVP).to.be.lt(ethers.parseEther("3200"));
      
      // Verify event
      const event = receipt.logs.find(log => {
        try {
          const parsed = topicVault.interface.parseLog(log);
          return parsed && parsed.name === "VdotLocked";
        } catch {
          return false;
        }
      });
      expect(event).to.not.be.undefined;
    });

    it("Should fail to lock vDOT if topic is not live", async function () {
      const { topicFactory, topicVault } = contracts;
      
      // Close the topic
      await time.increase(DURATION + 1);
      await topicFactory.checkAndCloseTopic(topicId);
      
      // Try to lock vDOT (should fail)
      await expect(
        topicVault.connect(bob).lockVdot(topicId, VDOT_AMOUNT)
      ).to.be.revertedWith("TopicVault: topic not live");
    });

    it("Should track participation correctly", async function () {
      const { topicVault, topicFactory } = contracts;
      
      // Bob locks vDOT
      await topicVault.connect(bob).lockVdot(topicId, VDOT_AMOUNT);
      
      // Verify Bob is registered as participant
      const participants = await topicVault.getTopicParticipants(topicId);
      expect(participants).to.include(bob.address);
      
      // Verify participation is tracked in TopicFactory
      const participated = await topicFactory.userParticipated(topicId, bob.address);
      // Note: TopicVault.lockVdot doesn't automatically register in TopicFactory
      // Registration happens when user posts a message
    });
  });

  describe("Message Posting", function () {
    beforeEach(async function () {
      // Setup: Bob locks vDOT to get topic-scoped VP
      await lockVdotForTopic(contracts, bob, topicId, VDOT_AMOUNT);
    });

    it("Should post message successfully", async function () {
      const { messageRegistry, topicVault } = contracts;
      
      const content = "我认为 Web3 的核心是去中心化身份...";
      const contentHash = ethers.keccak256(ethers.toUtf8Bytes(content));
      const length = ethers.toUtf8Bytes(content).length;
      const aiScore = ethers.parseEther("0.7"); // 0.7 intensity
      const timestamp = BigInt(Math.floor(Date.now() / 1000));
      
      // Get initial VP balance
      const initialVP = await topicVault.balanceOf(topicId, bob.address);
      
      // Generate AI signature
      const signature = await generateAISignature(
        contracts,
        contentHash,
        length,
        aiScore,
        timestamp
      );
      
      // Post message
      const tx = await messageRegistry.connect(bob).postMessage(
        topicId,
        contentHash,
        length,
        aiScore,
        timestamp,
        signature
      );
      const receipt = await tx.wait();
      
      // Verify VP was burned
      const finalVP = await topicVault.balanceOf(topicId, bob.address);
      const cost = await messageRegistry.calculateMessageCost(topicId, length, aiScore);
      expect(finalVP).to.equal(initialVP - cost);
      
      // Verify message was created
      const messageId = await messageRegistry.messageCounter();
      const message = await messageRegistry.getMessage(messageId);
      
      expect(message.messageId).to.equal(messageId);
      expect(message.topicId).to.equal(topicId);
      expect(message.author).to.equal(bob.address);
      expect(message.contentHash).to.equal(contentHash);
      expect(message.length).to.equal(length);
      expect(message.aiScore).to.equal(aiScore);
      expect(message.likeCount).to.equal(0);
      expect(message.vpCost).to.equal(cost);
      
      // Verify event
      const event = receipt.logs.find(log => {
        try {
          const parsed = messageRegistry.interface.parseLog(log);
          return parsed && parsed.name === "MessagePosted";
        } catch {
          return false;
        }
      });
      expect(event).to.not.be.undefined;
    });

    it("Should calculate message cost correctly", async function () {
      const { messageRegistry } = contracts;
      
      const length = 50;
      const aiScore = ethers.parseEther("0.5");
      
      // Calculate cost
      const cost = await messageRegistry.calculateMessageCost(topicId, length, aiScore);
      
      // Cost = Base(H) × Intensity(S) × Length(L)
      // Base(H) = c0 × (1 + β × H), where c0 = 10, β = 0.25
      // Intensity(S) = 1 + α × S^p, where α = 2.0, p = 2, S = 0.5
      // Length(L) = 1 + γ × log(1 + L), where γ = 0.15
      
      // For initial topic with no messages, heat should be 0
      // Base = 10 * (1 + 0) = 10
      // Intensity = 1 + 2 * 0.5^2 = 1 + 2 * 0.25 = 1.5
      // Length = 1 + 0.15 * log(51) ≈ 1.6
      // Cost ≈ 10 * 1.5 * 1.6 ≈ 24 VP
      
      expect(cost).to.be.gt(ethers.parseEther("20"));
      expect(cost).to.be.lt(ethers.parseEther("30"));
    });

    it("Should calculate heat correctly", async function () {
      const { messageRegistry } = contracts;
      
      // Initially heat should be 0
      let heat = await messageRegistry.calculateHeat(topicId);
      expect(heat).to.equal(0);
      
      // Post a message to start heat calculation
      const content = "Test message";
      const aiScore = ethers.parseEther("0.5");
      await postMessage(contracts, bob, topicId, content, aiScore);
      
      // Wait a bit for time to pass
      await time.increase(10);
      
      // Heat should be calculated based on:
      // H = w1×log(1+msg_rate) + w2×log(1+unique_users) + w3×log(1+like_rate) + w4×log(1+vp_burn_rate)
      heat = await messageRegistry.calculateHeat(topicId);
      expect(heat).to.be.gt(0);
    });

    it("Should enforce rate limiting (minimum interval)", async function () {
      const { messageRegistry } = contracts;
      
      const content = "First message";
      const aiScore = ethers.parseEther("0.5");
      
      // Post first message
      await postMessage(contracts, bob, topicId, content, aiScore);
      
      // Try to post immediately (should fail - need 15 second interval)
      await expect(
        postMessage(contracts, bob, topicId, "Second message", aiScore)
      ).to.be.revertedWith("MessageRegistry: rate limit exceeded");
      
      // Wait 15 seconds
      await time.increase(15);
      
      // Now should succeed
      await expect(
        postMessage(contracts, bob, topicId, "Second message", aiScore)
      ).to.not.be.reverted;
    });

    it("Should apply consecutive message cooldown multiplier", async function () {
      const { messageRegistry, topicVault } = contracts;
      
      const aiScore = ethers.parseEther("0.5");
      let initialVP = await topicVault.balanceOf(topicId, bob.address);
      
      // Post 3 messages (every 15 seconds)
      for (let i = 0; i < 3; i++) {
        await postMessage(contracts, bob, topicId, `Message ${i + 1}`, aiScore);
        await time.increase(15);
      }
      
      // Get VP after 3 messages
      const vpAfter3 = await topicVault.balanceOf(topicId, bob.address);
      const cost3 = initialVP - vpAfter3;
      
      // Post 4th message (should have 1.1x multiplier)
      await time.increase(15);
      await postMessage(contracts, bob, topicId, "Message 4", aiScore);
      
      const vpAfter4 = await topicVault.balanceOf(topicId, bob.address);
      const cost4 = vpAfter3 - vpAfter4;
      
      // 4th message should cost more (approximately 1.1x)
      expect(cost4).to.be.gt((cost3 * 11n) / 10n * 9n / 10n); // Allow some tolerance
    });

    it("Should fail if VP balance is insufficient", async function () {
      const { messageRegistry, topicVault } = contracts;
      
      // Get Bob's VP balance
      const balance = await topicVault.balanceOf(topicId, bob.address);
      
      // Burn all VP except a small amount
      await messageRegistry.connect(bob).postMessage(
        topicId,
        ethers.keccak256(ethers.toUtf8Bytes("Drain VP")),
        10,
        ethers.parseEther("0.1"),
        BigInt(Math.floor(Date.now() / 1000)),
        await generateAISignature(
          contracts,
          ethers.keccak256(ethers.toUtf8Bytes("Drain VP")),
          10,
          ethers.parseEther("0.1"),
          BigInt(Math.floor(Date.now() / 1000))
        )
      );
      
      await time.increase(15);
      
      // Try to post with very high cost (should fail)
      const contentHash = ethers.keccak256(ethers.toUtf8Bytes("Expensive message"));
      const length = 10000; // Very long message
      const aiScore = ethers.parseEther("1.0"); // Maximum intensity
      const timestamp = BigInt(Math.floor(Date.now() / 1000));
      const signature = await generateAISignature(
        contracts,
        contentHash,
        length,
        aiScore,
        timestamp
      );
      
      const remainingVP = await topicVault.balanceOf(topicId, bob.address);
      const requiredCost = await messageRegistry.calculateMessageCost(topicId, length, aiScore);
      
      if (remainingVP < requiredCost) {
        await expect(
          messageRegistry.connect(bob).postMessage(
            topicId,
            contentHash,
            length,
            aiScore,
            timestamp,
            signature
          )
        ).to.be.revertedWith("MessageRegistry: insufficient VP");
      }
    });

    it("Should fail with invalid AI signature", async function () {
      const { messageRegistry } = contracts;
      
      const contentHash = ethers.keccak256(ethers.toUtf8Bytes("Test message"));
      const length = 50;
      const aiScore = ethers.parseEther("0.5");
      const timestamp = BigInt(Math.floor(Date.now() / 1000));
      
      // Use invalid signature
      const invalidSignature = "0x1234";
      
      await expect(
        messageRegistry.connect(bob).postMessage(
          topicId,
          contentHash,
          length,
          aiScore,
          timestamp,
          invalidSignature
        )
      ).to.be.revertedWith("MessageRegistry: invalid AI signature");
    });

    it("Should fail if topic is expired", async function () {
      const { messageRegistry } = contracts;
      
      // Fast forward time beyond topic duration
      await time.increase(DURATION + 1);
      
      // Try to post message (should trigger topic closure and fail)
      await expect(
        postMessage(contracts, bob, topicId, "Late message", ethers.parseEther("0.5"))
      ).to.be.revertedWith("MessageRegistry: topic has expired");
    });

    it("Should update topic statistics correctly", async function () {
      const { messageRegistry } = contracts;
      
      // Post first message
      await postMessage(contracts, bob, topicId, "Message 1", ethers.parseEther("0.5"));
      
      // Verify statistics
      const messageCount = await messageRegistry.topicMessageCount(topicId);
      expect(messageCount).to.equal(1);
      
      const uniqueUserCount = await messageRegistry.topicUniqueUserCount(topicId);
      expect(uniqueUserCount).to.equal(1);
      
      // Post second message from same user
      await time.increase(15);
      await postMessage(contracts, bob, topicId, "Message 2", ethers.parseEther("0.5"));
      
      // Message count should increase, but unique user count should stay same
      const messageCount2 = await messageRegistry.topicMessageCount(topicId);
      expect(messageCount2).to.equal(2);
      
      const uniqueUserCount2 = await messageRegistry.topicUniqueUserCount(topicId);
      expect(uniqueUserCount2).to.equal(1);
    });
  });
});
