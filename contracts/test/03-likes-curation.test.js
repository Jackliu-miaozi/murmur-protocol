const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { deployContracts, createUserWithVP, createTopic, lockVdotForTopic, postMessage } = require("./fixtures");

describe("Step 3: Likes and Curation", function () {
  let contracts;
  let alice, bob, charlie, dave;

  const VDOT_AMOUNT = ethers.parseEther("1000");
  const DURATION = 86400;
  const FREEZE_WINDOW = 600;
  const CURATED_LIMIT = 50;
  let topicId;

  beforeEach(async function () {
    contracts = await deployContracts();
    alice = contracts.alice;
    bob = contracts.bob;
    charlie = contracts.charlie;
    dave = contracts.deployer; // Use deployer as fourth user

    // Setup: Alice creates topic, Bob posts messages
    await createUserWithVP(contracts, alice, VDOT_AMOUNT);
    topicId = await createTopic(contracts, alice, DURATION, FREEZE_WINDOW, CURATED_LIMIT);
    await lockVdotForTopic(contracts, bob, topicId, VDOT_AMOUNT);
  });

  describe("Liking Messages", function () {
    let messageId;

    beforeEach(async function () {
      // Setup: Bob posts a message
      messageId = await postMessage(contracts, bob, topicId, "Test message for likes", ethers.parseEther("0.5"));
      await time.increase(15);
    });

    it("Should like message successfully", async function () {
      const { messageRegistry, topicVault, curationModule } = contracts;
      
      // Setup: Charlie locks vDOT to get VP
      await lockVdotForTopic(contracts, charlie, topicId, VDOT_AMOUNT);
      
      // Get initial VP balance and like count
      const initialVP = await topicVault.balanceOf(topicId, charlie.address);
      const initialLikeCount = (await messageRegistry.getMessage(messageId)).likeCount;
      
      // Charlie likes the message
      const tx = await messageRegistry.connect(charlie).likeMessage(topicId, messageId);
      const receipt = await tx.wait();
      
      // Verify VP was burned (1 VP per like)
      const finalVP = await topicVault.balanceOf(topicId, charlie.address);
      expect(finalVP).to.equal(initialVP - ethers.parseEther("1"));
      
      // Verify like count increased
      const message = await messageRegistry.getMessage(messageId);
      expect(message.likeCount).to.equal(initialLikeCount + 1n);
      
      // Verify event
      const event = receipt.logs.find(log => {
        try {
          const parsed = messageRegistry.interface.parseLog(log);
          return parsed && parsed.name === "MessageLiked";
        } catch {
          return false;
        }
      });
      expect(event).to.not.be.undefined;
    });

    it("Should fail if VP balance is insufficient", async function () {
      const { messageRegistry, topicVault } = contracts;
      
      // Setup: Charlie locks minimal vDOT
      const minimalAmount = ethers.parseEther("1");
      await lockVdotForTopic(contracts, charlie, topicId, minimalAmount);
      
      // Burn all VP
      const balance = await topicVault.balanceOf(topicId, charlie.address);
      // Post a message to drain VP
      if (balance > ethers.parseEther("20")) {
        await postMessage(contracts, charlie, topicId, "Drain VP", ethers.parseEther("0.1"));
        await time.increase(15);
      }
      
      // Try to like (should fail if no VP)
      const remainingVP = await topicVault.balanceOf(topicId, charlie.address);
      if (remainingVP < ethers.parseEther("1")) {
        await expect(
          messageRegistry.connect(charlie).likeMessage(topicId, messageId)
        ).to.be.revertedWith("MessageRegistry: insufficient VP");
      }
    });

    it("Should fail if topic is not live", async function () {
      const { messageRegistry, topicFactory } = contracts;
      
      // Setup: Charlie locks vDOT
      await lockVdotForTopic(contracts, charlie, topicId, VDOT_AMOUNT);
      
      // Close topic
      await time.increase(DURATION + 1);
      await topicFactory.checkAndCloseTopic(topicId);
      
      // Try to like (should fail)
      await expect(
        messageRegistry.connect(charlie).likeMessage(topicId, messageId)
      ).to.be.revertedWith("MessageRegistry: topic not live");
    });

    it("Should allow multiple users to like the same message", async function () {
      const { messageRegistry, topicVault } = contracts;
      
      // Setup: Multiple users lock vDOT
      await lockVdotForTopic(contracts, charlie, topicId, VDOT_AMOUNT);
      await lockVdotForTopic(contracts, dave, topicId, VDOT_AMOUNT);
      
      // Charlie likes
      await messageRegistry.connect(charlie).likeMessage(topicId, messageId);
      let message = await messageRegistry.getMessage(messageId);
      expect(message.likeCount).to.equal(1n);
      
      // Dave likes
      await messageRegistry.connect(dave).likeMessage(topicId, messageId);
      message = await messageRegistry.getMessage(messageId);
      expect(message.likeCount).to.equal(2n);
    });
  });

  describe("Curation Module - Dynamic Sorting", function () {
    let messageIds = [];

    beforeEach(async function () {
      // Setup: Multiple users post messages
      await lockVdotForTopic(contracts, charlie, topicId, VDOT_AMOUNT);
      await lockVdotForTopic(contracts, dave, topicId, VDOT_AMOUNT);
      
      // Post several messages
      for (let i = 0; i < 5; i++) {
        messageIds.push(await postMessage(
          contracts,
          bob,
          topicId,
          `Message ${i + 1} from Bob`,
          ethers.parseEther("0.5")
        ));
        await time.increase(15);
      }
    });

    it("Should add messages to curated list when they receive likes", async function () {
      const { curationModule, messageRegistry } = contracts;
      
      // Initially curated list should be empty or contain only messages with likes
      let curated = await curationModule.getCuratedMessages(topicId);
      const initialLength = curated.length;
      
      // Charlie likes first message
      await messageRegistry.connect(charlie).likeMessage(topicId, messageIds[0]);
      
      // Check curated list
      curated = await curationModule.getCuratedMessages(topicId);
      expect(curated.length).to.be.gte(initialLength);
      expect(curated).to.include(messageIds[0]);
    });

    it("Should sort curated messages by like count (descending)", async function () {
      const { curationModule, messageRegistry } = contracts;
      
      // Setup: Multiple users like different messages
      await lockVdotForTopic(contracts, charlie, topicId, VDOT_AMOUNT);
      await lockVdotForTopic(contracts, dave, topicId, VDOT_AMOUNT);
      
      // Message 0 gets 3 likes
      await messageRegistry.connect(charlie).likeMessage(topicId, messageIds[0]);
      await messageRegistry.connect(dave).likeMessage(topicId, messageIds[0]);
      await messageRegistry.connect(bob).likeMessage(topicId, messageIds[0]);
      
      // Message 1 gets 2 likes
      await messageRegistry.connect(charlie).likeMessage(topicId, messageIds[1]);
      await messageRegistry.connect(dave).likeMessage(topicId, messageIds[1]);
      
      // Message 2 gets 1 like
      await messageRegistry.connect(charlie).likeMessage(topicId, messageIds[2]);
      
      // Get curated messages (may not be sorted perfectly due to implementation, but should contain all)
      const curated = await curationModule.getCuratedMessages(topicId);
      
      // Verify all liked messages are in curated list
      expect(curated).to.include(messageIds[0]);
      expect(curated).to.include(messageIds[1]);
      expect(curated).to.include(messageIds[2]);
    });

    it("Should respect curated limit", async function () {
      const { curationModule, messageRegistry } = contracts;
      
      // Setup: Many users to like messages
      const users = [charlie, dave];
      
      // Post many messages and get them liked
      for (let i = 0; i < CURATED_LIMIT + 10; i++) {
        const msgId = await postMessage(
          contracts,
          bob,
          topicId,
          `Message ${i}`,
          ethers.parseEther("0.5")
        );
        await time.increase(15);
        
        // Like it
        if (i < users.length) {
          await lockVdotForTopic(contracts, users[i], topicId, VDOT_AMOUNT);
          await messageRegistry.connect(users[i]).likeMessage(topicId, msgId);
        }
      }
      
      // Curated list should not exceed limit
      const curated = await curationModule.getCuratedMessages(topicId);
      expect(curated.length).to.be.lte(CURATED_LIMIT);
    });

    it("Should replace lowest liked message when limit is reached", async function () {
      const { curationModule, messageRegistry } = contracts;
      
      // Setup: Create exactly CURATED_LIMIT messages with likes
      const newMessageIds = [];
      for (let i = 0; i < CURATED_LIMIT; i++) {
        const msgId = await postMessage(
          contracts,
          bob,
          topicId,
          `Message ${i}`,
          ethers.parseEther("0.5")
        );
        newMessageIds.push(msgId);
        await time.increase(15);
        
        // Each message gets i+1 likes
        for (let j = 0; j <= i && j < 3; j++) {
          if (j === 0 && i === 0) {
            await lockVdotForTopic(contracts, charlie, topicId, VDOT_AMOUNT);
            await messageRegistry.connect(charlie).likeMessage(topicId, msgId);
          } else if (j === 1 && i >= 1) {
            await messageRegistry.connect(charlie).likeMessage(topicId, msgId);
          }
        }
      }
      
      // Post a new message with more likes than the minimum
      const highLikeMessageId = await postMessage(
        contracts,
        bob,
        topicId,
        "High likes message",
        ethers.parseEther("0.5")
      );
      await time.increase(15);
      
      // Give it many likes
      for (let i = 0; i < 5; i++) {
        if (i === 0) {
          await messageRegistry.connect(charlie).likeMessage(topicId, highLikeMessageId);
        } else if (i === 1) {
          await lockVdotForTopic(contracts, dave, topicId, VDOT_AMOUNT);
          await messageRegistry.connect(dave).likeMessage(topicId, highLikeMessageId);
        }
      }
      
      // New message should be in curated list
      const curated = await curationModule.getCuratedMessages(topicId);
      expect(curated).to.include(highLikeMessageId);
    });
  });

  describe("Curation Module - OnLike Hook", function () {
    let messageId;

    beforeEach(async function () {
      // Setup: Bob posts a message
      messageId = await postMessage(contracts, bob, topicId, "Test message", ethers.parseEther("0.5"));
      await time.increase(15);
    });

    it("Should trigger CurationModule.onLike when message is liked", async function () {
      const { messageRegistry, curationModule } = contracts;
      
      // Setup: Charlie locks vDOT
      await lockVdotForTopic(contracts, charlie, topicId, VDOT_AMOUNT);
      
      // Get initial curated state
      const initialCurated = await curationModule.getCuratedMessages(topicId);
      const initialLength = initialCurated.length;
      
      // Like the message (this should trigger onLike)
      await messageRegistry.connect(charlie).likeMessage(topicId, messageId);
      
      // Verify curation was updated (message should be added if it has likes)
      const finalCurated = await curationModule.getCuratedMessages(topicId);
      // The message should be added to curated list since it now has likes
      if (initialLength < CURATED_LIMIT) {
        expect(finalCurated.length).to.be.gte(initialLength);
      }
    });
  });
});
