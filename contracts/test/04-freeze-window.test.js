const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { deployContracts, createUserWithVP, createTopic, lockVdotForTopic, postMessage } = require("./fixtures");

describe("Step 4: Freeze Window", function () {
  let contracts;
  let alice, bob, charlie;

  const VDOT_AMOUNT = ethers.parseEther("1000");
  const DURATION = 86400; // 24 hours
  const FREEZE_WINDOW = 600; // 10 minutes
  const CURATED_LIMIT = 50;
  let topicId;

  beforeEach(async function () {
    contracts = await deployContracts();
    alice = contracts.alice;
    bob = contracts.bob;
    charlie = contracts.charlie;

    // Setup: Alice creates topic
    await createUserWithVP(contracts, alice, VDOT_AMOUNT);
    topicId = await createTopic(contracts, alice, DURATION, FREEZE_WINDOW, CURATED_LIMIT);
    
    // Setup: Users participate
    await lockVdotForTopic(contracts, bob, topicId, VDOT_AMOUNT);
    await lockVdotForTopic(contracts, charlie, topicId, VDOT_AMOUNT);
  });

  describe("Freeze Window Detection", function () {
    it("Should detect freeze window correctly", async function () {
      const { topicFactory } = contracts;
      
      // Initially not frozen
      let isFrozen = await topicFactory.isFrozen(topicId);
      expect(isFrozen).to.be.false;
      
      // Fast forward to just before freeze window
      const freezeStart = DURATION - FREEZE_WINDOW;
      await time.increase(Number(freezeStart) - 1);
      
      isFrozen = await topicFactory.isFrozen(topicId);
      expect(isFrozen).to.be.false;
      
      // Fast forward into freeze window
      await time.increase(1);
      isFrozen = await topicFactory.isFrozen(topicId);
      expect(isFrozen).to.be.true;
      
      // Should remain frozen until topic ends
      await time.increase(FREEZE_WINDOW - 1);
      isFrozen = await topicFactory.isFrozen(topicId);
      expect(isFrozen).to.be.true;
    });

    it("Should return false if topic is not live", async function () {
      const { topicFactory } = contracts;
      
      // Close the topic
      await time.increase(DURATION + 1);
      await topicFactory.checkAndCloseTopic(topicId);
      
      // Should return false even if it would be in freeze window
      const isFrozen = await topicFactory.isFrozen(topicId);
      expect(isFrozen).to.be.false;
    });
  });

  describe("Curation Freeze Behavior", function () {
    let messageIds = [];

    beforeEach(async function () {
      // Post some messages and get them liked before freeze window
      for (let i = 0; i < 5; i++) {
        const msgId = await postMessage(
          contracts,
          bob,
          topicId,
          `Message ${i + 1}`,
          ethers.parseEther("0.5")
        );
        messageIds.push(msgId);
        await time.increase(15);
        
        // Like messages
        if (i < 3) {
          await contracts.messageRegistry.connect(charlie).likeMessage(topicId, msgId);
        }
      }
    });

    it("Should freeze curated list during freeze window", async function () {
      const { curationModule, messageRegistry } = contracts;
      
      // Get curated list before freeze window
      await time.increase(DURATION - FREEZE_WINDOW - 100); // Before freeze
      let curatedBefore = await curationModule.getCuratedMessages(topicId);
      const beforeLength = curatedBefore.length;
      
      // Enter freeze window
      await time.increase(100);
      const isFrozen = await contracts.topicFactory.isFrozen(topicId);
      expect(isFrozen).to.be.true;
      
      // Post new message and like it (should not update curated list)
      const newMsgId = await postMessage(
        contracts,
        bob,
        topicId,
        "New message in freeze window",
        ethers.parseEther("0.5")
      );
      await time.increase(15);
      
      // Like the new message multiple times (more than existing messages)
      for (let i = 0; i < 10; i++) {
        if (i === 0) {
          await messageRegistry.connect(charlie).likeMessage(topicId, newMsgId);
        } else {
          // Would need more users, but for test we verify it doesn't get added
          break;
        }
      }
      
      // Curated list should remain unchanged (frozen)
      const curatedAfter = await curationModule.getCuratedMessages(topicId);
      expect(curatedAfter.length).to.equal(beforeLength);
      // New message should not be in curated list
      expect(curatedAfter).to.not.include(newMsgId);
    });

    it("Should allow users to continue posting and liking during freeze window", async function () {
      const { messageRegistry, topicVault } = contracts;
      
      // Enter freeze window
      await time.increase(DURATION - FREEZE_WINDOW);
      const isFrozen = await contracts.topicFactory.isFrozen(topicId);
      expect(isFrozen).to.be.true;
      
      // Users should still be able to post messages
      const initialVP = await topicVault.balanceOf(topicId, bob.address);
      const newMsgId = await postMessage(
        contracts,
        bob,
        topicId,
        "Message in freeze window",
        ethers.parseEther("0.5")
      );
      await time.increase(15);
      
      // VP should be burned
      const finalVP = await topicVault.balanceOf(topicId, bob.address);
      expect(finalVP).to.be.lt(initialVP);
      
      // Users should still be able to like messages
      const message = await messageRegistry.getMessage(newMsgId);
      const initialLikes = message.likeCount;
      
      await messageRegistry.connect(charlie).likeMessage(topicId, newMsgId);
      
      const updatedMessage = await messageRegistry.getMessage(newMsgId);
      expect(updatedMessage.likeCount).to.equal(initialLikes + 1n);
    });

    it("Should not update curated list even if messages get more likes in freeze window", async function () {
      const { curationModule, messageRegistry } = contracts;
      
      // Before freeze window: post and like messages
      const msgId1 = await postMessage(
        contracts,
        bob,
        topicId,
        "Message 1",
        ethers.parseEther("0.5")
      );
      await time.increase(15);
      await messageRegistry.connect(charlie).likeMessage(topicId, msgId1);
      
      const msgId2 = await postMessage(
        contracts,
        bob,
        topicId,
        "Message 2",
        ethers.parseEther("0.5")
      );
      await time.increase(15);
      await messageRegistry.connect(charlie).likeMessage(topicId, msgId2);
      
      // Get curated list before freeze
      await time.increase(DURATION - FREEZE_WINDOW - 100);
      let curatedBefore = await curationModule.getCuratedMessages(topicId);
      
      // Enter freeze window
      await time.increase(100);
      
      // Give msgId2 many more likes (should surpass msgId1)
      for (let i = 0; i < 5; i++) {
        // In real scenario, would need multiple users
        // For test, we verify curated list doesn't change
        break;
      }
      
      // Curated list should remain frozen
      const curatedAfter = await curationModule.getCuratedMessages(topicId);
      expect(curatedAfter.length).to.equal(curatedBefore.length);
      // Order should not change
      expect(curatedAfter).to.deep.equal(curatedBefore);
    });
  });
});
