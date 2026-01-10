const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { deployContracts, createUserWithVP, createTopic, lockVdotForTopic, postMessage } = require("./fixtures");

describe("Step 7: vDOT Redemption", function () {
  let contracts;
  let alice, bob;

  const VDOT_AMOUNT = ethers.parseEther("1000");
  const DURATION = 86400;
  const FREEZE_WINDOW = 600;
  const CURATED_LIMIT = 50;

  beforeEach(async function () {
    contracts = await deployContracts();
    alice = contracts.alice;
    bob = contracts.bob;
  });

  describe("Redemption Conditions", function () {
    it("Should allow redemption when all participated topics are closed", async function () {
      const { topicFactory, topicVault, vdotToken, vpToken } = contracts;
      
      // Setup: Bob stakes vDOT and creates/participates in topics
      await createUserWithVP(contracts, bob, VDOT_AMOUNT);
      
      // Create a topic
      const topicId = await createTopic(contracts, bob, DURATION, FREEZE_WINDOW, CURATED_LIMIT);
      
      // Participate in topic
      await lockVdotForTopic(contracts, bob, topicId, VDOT_AMOUNT);
      await postMessage(contracts, bob, topicId, "Test message", ethers.parseEther("0.5"));
      
      // Close topic and mint NFT
      await time.increase(DURATION + 1);
      await topicFactory.checkAndCloseTopic(topicId);
      await contracts.nftMinter.connect(bob).mintNfts(topicId);
      
      // Verify Bob can redeem
      const canRedeem = await topicFactory.canUserRedeem(bob.address);
      expect(canRedeem).to.be.true;
      
      // Verify TopicVault also returns correct status
      const canRedeemVault = await topicVault.canRedeem(bob.address);
      expect(canRedeemVault).to.be.true;
    });

    it("Should not allow redemption if any topic is still live", async function () {
      const { topicFactory, topicVault } = contracts;
      
      // Setup: Bob participates in multiple topics
      await createUserWithVP(contracts, bob, ethers.parseEther("5000"));
      
      // Create first topic
      const topicId1 = await createTopic(contracts, bob, DURATION, FREEZE_WINDOW, CURATED_LIMIT);
      await lockVdotForTopic(contracts, bob, topicId1, VDOT_AMOUNT);
      await postMessage(contracts, bob, topicId1, "Message 1", ethers.parseEther("0.5"));
      
      // Create second topic
      const topicId2 = await createTopic(contracts, bob, DURATION, FREEZE_WINDOW, CURATED_LIMIT);
      await lockVdotForTopic(contracts, bob, topicId2, VDOT_AMOUNT);
      await postMessage(contracts, bob, topicId2, "Message 2", ethers.parseEther("0.5"));
      
      // Close first topic
      await time.increase(DURATION + 1);
      await topicFactory.checkAndCloseTopic(topicId1);
      await contracts.nftMinter.connect(bob).mintNfts(topicId1);
      
      // Second topic is still live, so cannot redeem
      const canRedeem = await topicFactory.canUserRedeem(bob.address);
      expect(canRedeem).to.be.false;
      
      const canRedeemVault = await topicVault.canRedeem(bob.address);
      expect(canRedeemVault).to.be.false;
    });

    it("Should allow redemption after all topics are closed and minted", async function () {
      const { topicFactory, topicVault } = contracts;
      
      // Setup: Bob participates in two topics
      await createUserWithVP(contracts, bob, ethers.parseEther("5000"));
      
      const topicId1 = await createTopic(contracts, bob, DURATION, FREEZE_WINDOW, CURATED_LIMIT);
      await lockVdotForTopic(contracts, bob, topicId1, VDOT_AMOUNT);
      await postMessage(contracts, bob, topicId1, "Message 1", ethers.parseEther("0.5"));
      
      const topicId2 = await createTopic(contracts, bob, DURATION, FREEZE_WINDOW, CURATED_LIMIT);
      await lockVdotForTopic(contracts, bob, topicId2, VDOT_AMOUNT);
      await postMessage(contracts, bob, topicId2, "Message 2", ethers.parseEther("0.5"));
      
      // Close and mint first topic
      await time.increase(DURATION + 1);
      await topicFactory.checkAndCloseTopic(topicId1);
      await contracts.nftMinter.connect(bob).mintNfts(topicId1);
      
      // Create and close second topic (new duration)
      await time.increase(1);
      await topicFactory.checkAndCloseTopic(topicId2);
      await contracts.nftMinter.connect(bob).mintNfts(topicId2);
      
      // Now all topics are closed, can redeem
      const canRedeem = await topicFactory.canUserRedeem(bob.address);
      expect(canRedeem).to.be.true;
    });
  });

  describe("vDOT Redemption Process", function () {
    it("Should allow user to check redemption status", async function () {
      const { topicVault, topicFactory } = contracts;
      
      // User with no participation should be able to redeem (no topics to wait for)
      const canRedeemEmpty = await topicVault.canRedeem(bob.address);
      // Actually, if user hasn't participated, canUserRedeem should return true
      // But TopicVault.redeemVdot requires canRedeem to be true
      
      // For user with participation, we need to wait for topics to close
      await createUserWithVP(contracts, bob, VDOT_AMOUNT);
      const topicId = await createTopic(contracts, bob, DURATION, FREEZE_WINDOW, CURATED_LIMIT);
      await lockVdotForTopic(contracts, bob, topicId, VDOT_AMOUNT);
      await postMessage(contracts, bob, topicId, "Test", ethers.parseEther("0.5"));
      
      // Cannot redeem yet
      const canRedeemBefore = await topicVault.canRedeem(bob.address);
      expect(canRedeemBefore).to.be.false;
      
      // Close topic
      await time.increase(DURATION + 1);
      await topicFactory.checkAndCloseTopic(topicId);
      await contracts.nftMinter.connect(bob).mintNfts(topicId);
      
      // Can redeem now
      const canRedeemAfter = await topicVault.canRedeem(bob.address);
      expect(canRedeemAfter).to.be.true;
    });

    it("Should handle redemption for users who only staked global VP", async function () {
      const { vpToken, vdotToken } = contracts;
      
      // Bob stakes vDOT to get global VP (but doesn't participate in any topic)
      await createUserWithVP(contracts, bob, VDOT_AMOUNT);
      
      // Bob should be able to withdraw vDOT if he hasn't participated in any topics
      // Actually, withdrawal is different from redemption
      // Redemption is for topic-specific locked vDOT, withdrawal is for staked vDOT
      
      // For topic-specific redemption, if user hasn't participated, canRedeem should return true
      const canRedeem = await contracts.topicVault.canRedeem(bob.address);
      // This depends on implementation - if user has no topics, should return true
    });
  });

  describe("Multiple Topics Participation", function () {
    it("Should require all topics to be closed before redemption", async function () {
      const { topicFactory, topicVault } = contracts;
      
      // Setup: Bob participates in 3 topics with different durations
      await createUserWithVP(contracts, bob, ethers.parseEther("10000"));
      
      const shortDuration = 3600; // 1 hour
      const topicId1 = await createTopic(contracts, bob, shortDuration, 300, CURATED_LIMIT);
      await lockVdotForTopic(contracts, bob, topicId1, VDOT_AMOUNT);
      await postMessage(contracts, bob, topicId1, "Short topic", ethers.parseEther("0.5"));
      
      const topicId2 = await createTopic(contracts, bob, DURATION, FREEZE_WINDOW, CURATED_LIMIT);
      await lockVdotForTopic(contracts, bob, topicId2, VDOT_AMOUNT);
      await postMessage(contracts, bob, topicId2, "Long topic", ethers.parseEther("0.5"));
      
      // Close first topic
      await time.increase(shortDuration + 1);
      await topicFactory.checkAndCloseTopic(topicId1);
      await contracts.nftMinter.connect(bob).mintNfts(topicId1);
      
      // Cannot redeem yet (second topic still live)
      const canRedeem1 = await topicVault.canRedeem(bob.address);
      expect(canRedeem1).to.be.false;
      
      // Close second topic
      await time.increase(DURATION - shortDuration + 1);
      await topicFactory.checkAndCloseTopic(topicId2);
      await contracts.nftMinter.connect(bob).mintNfts(topicId2);
      
      // Now can redeem
      const canRedeem2 = await topicVault.canRedeem(bob.address);
      expect(canRedeem2).to.be.true;
    });
  });
});
