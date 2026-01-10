const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { deployContracts, createUserWithVP, createTopic } = require("./fixtures");

describe("Step 1: Topic Creation", function () {
  let contracts;
  let alice, bob;

  const VDOT_AMOUNT = ethers.parseEther("1000"); // 1000 vDOT
  const DURATION = 86400; // 24 hours
  const FREEZE_WINDOW = 600; // 10 minutes
  const CURATED_LIMIT = 50;

  beforeEach(async function () {
    contracts = await deployContracts();
    alice = contracts.alice;
    bob = contracts.bob;
  });

  describe("vDOT Minting and VP Staking", function () {
    it("Should mint vDOT tokens to Alice", async function () {
      const { vdotToken } = contracts;
      
      // Mint vDOT to Alice
      await vdotToken.connect(contracts.deployer).mint(alice.address, VDOT_AMOUNT);
      
      const balance = await vdotToken.balanceOf(alice.address);
      expect(balance).to.equal(VDOT_AMOUNT);
    });

    it("Should stake vDOT and receive VP correctly", async function () {
      const { vdotToken, vpToken } = contracts;
      
      // Mint vDOT to Alice
      await vdotToken.connect(contracts.deployer).mint(alice.address, VDOT_AMOUNT);
      
      // Approve and stake
      await vdotToken.connect(alice).approve(await vpToken.getAddress(), VDOT_AMOUNT);
      const tx = await vpToken.connect(alice).stakeVdot(VDOT_AMOUNT);
      const receipt = await tx.wait();
      
      // Verify VP calculation: VP = 100 * √vDOT
      // For 1000 vDOT: VP ≈ 3162 (with 18 decimals)
      const expectedVP = await vpToken.calculateVP(VDOT_AMOUNT);
      const actualVP = await vpToken.balanceOf(alice.address);
      
      expect(actualVP).to.equal(expectedVP);
      expect(actualVP).to.be.gt(ethers.parseEther("3000")); // Should be > 3000
      expect(actualVP).to.be.lt(ethers.parseEther("3200")); // Should be < 3200
      
      // Verify event
      const event = receipt.logs.find(log => {
        try {
          const parsed = vpToken.interface.parseLog(log);
          return parsed && parsed.name === "VdotStaked";
        } catch {
          return false;
        }
      });
      expect(event).to.not.be.undefined;
      
      // Verify vDOT is locked in VPToken contract
      const stakedAmount = await vpToken.stakedVdot(alice.address);
      expect(stakedAmount).to.equal(VDOT_AMOUNT);
    });

    it("Should calculate VP correctly for different amounts", async function () {
      const { vpToken } = contracts;
      
      // Test with 100 vDOT: VP = 100 * √100 ≈ 1000
      const vp100 = await vpToken.calculateVP(ethers.parseEther("100"));
      expect(vp100).to.be.closeTo(ethers.parseEther("1000"), ethers.parseEther("50"));
      
      // Test with 10000 vDOT: VP = 100 * √10000 = 10000
      const vp10000 = await vpToken.calculateVP(ethers.parseEther("10000"));
      expect(vp10000).to.equal(ethers.parseEther("10000"));
    });
  });

  describe("Creation Cost Calculation", function () {
    it("Should calculate base creation cost correctly with no active topics", async function () {
      const { topicFactory } = contracts;
      
      // With 0 active topics, cost should be base cost (1000 VP)
      const cost = await topicFactory.quoteCreationCost();
      expect(cost).to.equal(ethers.parseEther("1000"));
    });

    it("Should calculate creation cost with active topics", async function () {
      const { topicFactory, vdotToken, vpToken } = contracts;
      
      // Give Alice enough VP to create multiple topics
      const largeAmount = ethers.parseEther("10000");
      await vdotToken.connect(contracts.deployer).mint(alice.address, largeAmount);
      await vdotToken.connect(alice).approve(await vpToken.getAddress(), largeAmount);
      await vpToken.connect(alice).stakeVdot(largeAmount);
      
      // Create first topic (should cost base cost)
      const metadataHash1 = ethers.keccak256(ethers.toUtf8Bytes("Topic 1"));
      await topicFactory.connect(alice).createTopic(metadataHash1, DURATION, FREEZE_WINDOW, CURATED_LIMIT);
      
      // Second topic should cost more: baseCost * (1 + alpha * log(1 + 1))
      // alpha = 2.0, log(2) ≈ 0.693, so multiplier ≈ 1 + 2 * 0.693 ≈ 2.386
      const cost2 = await topicFactory.quoteCreationCost();
      expect(cost2).to.be.gt(ethers.parseEther("1000"));
      
      // Create second topic
      const metadataHash2 = ethers.keccak256(ethers.toUtf8Bytes("Topic 2"));
      await topicFactory.connect(alice).createTopic(metadataHash2, DURATION, FREEZE_WINDOW, CURATED_LIMIT);
      
      // Third topic should cost even more
      const cost3 = await topicFactory.quoteCreationCost();
      expect(cost3).to.be.gt(cost2);
    });
  });

  describe("Topic Creation", function () {
    beforeEach(async function () {
      // Setup: Alice stakes vDOT and gets VP
      await createUserWithVP(contracts, alice, VDOT_AMOUNT);
    });

    it("Should create topic successfully", async function () {
      const { topicFactory, vpToken } = contracts;
      
      // Get initial VP balance
      const initialVP = await vpToken.balanceOf(alice.address);
      
      // Get creation cost
      const creationCost = await topicFactory.quoteCreationCost();
      
      // Create topic
      const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("Web3 Future Development"));
      const tx = await topicFactory.connect(alice).createTopic(
        metadataHash,
        DURATION,
        FREEZE_WINDOW,
        CURATED_LIMIT
      );
      const receipt = await tx.wait();
      
      // Verify VP was deducted
      const finalVP = await vpToken.balanceOf(alice.address);
      expect(finalVP).to.equal(initialVP - creationCost);
      
      // Verify topic was created
      const topicId = await topicFactory.topicCounter();
      const topic = await topicFactory.getTopic(topicId);
      
      expect(topic.topicId).to.equal(topicId);
      expect(topic.creator).to.equal(alice.address);
      expect(topic.metadataHash).to.equal(metadataHash);
      expect(topic.duration).to.equal(DURATION);
      expect(topic.freezeWindow).to.equal(FREEZE_WINDOW);
      expect(topic.curatedLimit).to.equal(CURATED_LIMIT);
      expect(topic.status).to.equal(1); // TopicStatus.Live
      expect(topic.minted).to.be.false;
      
      // Verify event
      const event = receipt.logs.find(log => {
        try {
          const parsed = topicFactory.interface.parseLog(log);
          return parsed && parsed.name === "TopicCreated";
        } catch {
          return false;
        }
      });
      expect(event).to.not.be.undefined;
    });

    it("Should fail if VP balance is insufficient", async function () {
      const { topicFactory, vdotToken, vpToken } = contracts;
      
      // Give Alice only a small amount of vDOT
      const smallAmount = ethers.parseEther("100");
      await vdotToken.connect(contracts.deployer).mint(alice.address, smallAmount);
      await vdotToken.connect(alice).approve(await vpToken.getAddress(), smallAmount);
      await vpToken.connect(alice).stakeVdot(smallAmount);
      
      // Try to create topic (should fail because creation cost is 1000 VP)
      const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("Test Topic"));
      await expect(
        topicFactory.connect(alice).createTopic(
          metadataHash,
          DURATION,
          FREEZE_WINDOW,
          CURATED_LIMIT
        )
      ).to.be.revertedWith("TopicFactory: insufficient VP");
    });

    it("Should fail with invalid parameters", async function () {
      const { topicFactory } = contracts;
      const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("Test Topic"));
      
      // Invalid metadata hash (zero)
      await expect(
        topicFactory.connect(alice).createTopic(
          ethers.ZeroHash,
          DURATION,
          FREEZE_WINDOW,
          CURATED_LIMIT
        )
      ).to.be.revertedWith("TopicFactory: invalid metadata hash");
      
      // Invalid duration (zero)
      await expect(
        topicFactory.connect(alice).createTopic(
          metadataHash,
          0,
          FREEZE_WINDOW,
          CURATED_LIMIT
        )
      ).to.be.revertedWith("TopicFactory: invalid duration");
      
      // Invalid freeze window (>= duration)
      await expect(
        topicFactory.connect(alice).createTopic(
          metadataHash,
          DURATION,
          DURATION, // freezeWindow >= duration
          CURATED_LIMIT
        )
      ).to.be.revertedWith("TopicFactory: invalid freeze window");
      
      // Invalid curated limit (zero)
      await expect(
        topicFactory.connect(alice).createTopic(
          metadataHash,
          DURATION,
          FREEZE_WINDOW,
          0
        )
      ).to.be.revertedWith("TopicFactory: invalid curated limit");
      
      // Invalid curated limit (> 100)
      await expect(
        topicFactory.connect(alice).createTopic(
          metadataHash,
          DURATION,
          FREEZE_WINDOW,
          101
        )
      ).to.be.revertedWith("TopicFactory: invalid curated limit");
    });

    it("Should track active topic count correctly", async function () {
      const { topicFactory } = contracts;
      
      // Initially no active topics
      const activeCount1 = await topicFactory.activeTopicCount();
      expect(activeCount1).to.equal(0);
      
      // Create first topic
      await createTopic(contracts, alice, DURATION, FREEZE_WINDOW, CURATED_LIMIT);
      const activeCount2 = await topicFactory.activeTopicCount();
      expect(activeCount2).to.equal(1);
      
      // Create second topic
      await createTopic(contracts, alice, DURATION, FREEZE_WINDOW, CURATED_LIMIT);
      const activeCount3 = await topicFactory.activeTopicCount();
      expect(activeCount3).to.equal(2);
    });

    it("Should register user participation in topic", async function () {
      const { topicFactory } = contracts;
      
      const topicId = await createTopic(contracts, alice, DURATION, FREEZE_WINDOW, CURATED_LIMIT);
      
      // Verify Alice is registered as participant
      const participated = await topicFactory.userParticipated(topicId, alice.address);
      expect(participated).to.be.true;
      
      // Verify topic is in user's topic list
      const userTopics = await topicFactory.getUserTopics(alice.address);
      expect(userTopics).to.include(topicId);
    });
  });
});
