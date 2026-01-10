const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { deployContracts, createUserWithVP, createTopic, lockVdotForTopic, postMessage } = require("./fixtures");

describe("Step 5: Topic Closure", function () {
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

    // Setup: Alice creates topic
    await createUserWithVP(contracts, alice, VDOT_AMOUNT);
    topicId = await createTopic(contracts, alice, DURATION, FREEZE_WINDOW, CURATED_LIMIT);
  });

  describe("Automatic Topic Closure", function () {
    it("Should automatically close topic when expired (via checkAndCloseTopic)", async function () {
      const { topicFactory } = contracts;
      
      // Initially topic is Live
      let topic = await topicFactory.getTopic(topicId);
      expect(topic.status).to.equal(1); // TopicStatus.Live
      
      // Fast forward beyond duration
      await time.increase(DURATION + 1);
      
      // Check if expired
      const isExpired = await topicFactory.isExpired(topicId);
      expect(isExpired).to.be.true;
      
      // Close topic
      const tx = await topicFactory.checkAndCloseTopic(topicId);
      const receipt = await tx.wait();
      
      // Verify topic is closed
      topic = await topicFactory.getTopic(topicId);
      expect(topic.status).to.equal(2); // TopicStatus.Closed
      
      // Verify active topic count decreased
      const activeCount = await topicFactory.activeTopicCount();
      expect(activeCount).to.equal(0);
      
      // Verify event
      const event = receipt.logs.find(log => {
        try {
          const parsed = topicFactory.interface.parseLog(log);
          return parsed && parsed.name === "TopicClosed";
        } catch {
          return false;
        }
      });
      expect(event).to.not.be.undefined;
    });

    it("Should close topic automatically when posting message after expiration", async function () {
      const { topicFactory, messageRegistry } = contracts;
      
      // Setup: Bob participates
      await lockVdotForTopic(contracts, bob, topicId, VDOT_AMOUNT);
      
      // Fast forward beyond duration
      await time.increase(DURATION + 1);
      
      // Try to post message (should trigger closure and fail)
      await expect(
        postMessage(contracts, bob, topicId, "Late message", ethers.parseEther("0.5"))
      ).to.be.revertedWith("MessageRegistry: topic has expired");
      
      // Topic should be closed
      const topic = await topicFactory.getTopic(topicId);
      expect(topic.status).to.equal(2); // TopicStatus.Closed
    });

    it("Should not close topic if not expired", async function () {
      const { topicFactory } = contracts;
      
      // Try to close before expiration
      const closed = await topicFactory.checkAndCloseTopic(topicId);
      expect(closed).to.be.false;
      
      // Topic should still be Live
      const topic = await topicFactory.getTopic(topicId);
      expect(topic.status).to.equal(1); // TopicStatus.Live
    });

    it("Should not close topic if already closed", async function () {
      const { topicFactory } = contracts;
      
      // Close topic
      await time.increase(DURATION + 1);
      await topicFactory.checkAndCloseTopic(topicId);
      
      // Try to close again
      const closed = await topicFactory.checkAndCloseTopic(topicId);
      expect(closed).to.be.false;
    });
  });

  describe("Manual Topic Closure", function () {
    it("Should allow manual closure by anyone when expired", async function () {
      const { topicFactory } = contracts;
      
      // Fast forward beyond duration
      await time.increase(DURATION + 1);
      
      // Anyone can close expired topic
      const tx = await topicFactory.connect(bob).closeTopic(topicId);
      const receipt = await tx.wait();
      
      // Verify topic is closed
      const topic = await topicFactory.getTopic(topicId);
      expect(topic.status).to.equal(2); // TopicStatus.Closed
      
      // Verify event
      const event = receipt.logs.find(log => {
        try {
          const parsed = topicFactory.interface.parseLog(log);
          return parsed && parsed.name === "TopicClosed";
        } catch {
          return false;
        }
      });
      expect(event).to.not.be.undefined;
    });

    it("Should fail to manually close if topic is not expired", async function () {
      const { topicFactory } = contracts;
      
      // Try to close before expiration
      await expect(
        topicFactory.connect(bob).closeTopic(topicId)
      ).to.be.revertedWith("TopicFactory: topic not expired");
    });

    it("Should fail to manually close if topic is not live", async function () {
      const { topicFactory } = contracts;
      
      // Close topic first
      await time.increase(DURATION + 1);
      await topicFactory.checkAndCloseTopic(topicId);
      
      // Try to close again
      await expect(
        topicFactory.connect(bob).closeTopic(topicId)
      ).to.be.revertedWith("TopicFactory: topic not live");
    });
  });

  describe("Curated Set Hash Calculation", function () {
    beforeEach(async function () {
      // Setup: Post messages and get likes
      await lockVdotForTopic(contracts, bob, topicId, VDOT_AMOUNT);
      
      for (let i = 0; i < 5; i++) {
        const msgId = await postMessage(
          contracts,
          bob,
          topicId,
          `Message ${i + 1}`,
          ethers.parseEther("0.5")
        );
        await time.increase(15);
        
        // Like some messages
        if (i < 3) {
          await contracts.messageRegistry.connect(bob).likeMessage(topicId, msgId);
          await time.increase(1);
        }
      }
    });

    it("Should calculate curated set hash correctly", async function () {
      const { curationModule } = contracts;
      
      // Close topic first
      await time.increase(DURATION + 1);
      await contracts.topicFactory.checkAndCloseTopic(topicId);
      
      // Get curated set hash
      const hash = await curationModule.curatedSetHash(topicId);
      expect(hash).to.not.equal(ethers.ZeroHash);
      
      // Hash should be deterministic
      const hash2 = await curationModule.curatedSetHash(topicId);
      expect(hash2).to.equal(hash);
    });
  });
});
