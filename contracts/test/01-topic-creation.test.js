const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployContracts, createUserWithVP, createTopic } = require('./fixtures');

describe('TopicFactory', function () {
  let contracts;
  let owner;
  let addr1;

  const VDOT_AMOUNT = ethers.parseEther("1000");
  const DURATION = 86400;
  const FREEZE_WINDOW = 600;
  const CURATED_LIMIT = 50;

  beforeEach(async function () {
    // Get contracts and signers
    contracts = await deployContracts();
    owner = contracts.alice;
    addr1 = contracts.bob;
  });

  describe('Basic functionality', function () {
    it('Should mint vDOT tokens to owner', async function () {
      const { vdotToken } = contracts;
      
      await vdotToken.connect(contracts.deployer).mint(owner.address, VDOT_AMOUNT);
      
      const balance = await vdotToken.balanceOf(owner.address);
      expect(balance).to.equal(VDOT_AMOUNT);
    });

    it('Should stake vDOT and receive VP correctly', async function () {
      const { vdotToken, vpToken } = contracts;
      
      await vdotToken.connect(contracts.deployer).mint(owner.address, VDOT_AMOUNT);
      await vdotToken.connect(owner).approve(await vpToken.getAddress(), VDOT_AMOUNT);
      
      const expectedVP = await vpToken.calculateVP(VDOT_AMOUNT);
      
      // Check if the VdotStaked event is emitted with the correct values
      await expect(vpToken.connect(owner).stakeVdot(VDOT_AMOUNT))
        .to.emit(vpToken, 'VdotStaked')
        .withArgs(owner.address, VDOT_AMOUNT, expectedVP);
      
      const actualVP = await vpToken.balanceOf(owner.address);
      expect(actualVP).to.equal(expectedVP);
      expect(actualVP).to.be.gt(ethers.parseEther("3000"));
      expect(actualVP).to.be.lt(ethers.parseEther("3200"));
      
      const stakedAmount = await vpToken.stakedVdot(owner.address);
      expect(stakedAmount).to.equal(VDOT_AMOUNT);
    });

    it('Should calculate VP correctly for different amounts', async function () {
      const { vpToken } = contracts;
      
      const vp100 = await vpToken.calculateVP(ethers.parseEther("100"));
      expect(vp100).to.be.closeTo(ethers.parseEther("1000"), ethers.parseEther("50"));
      
      const vp10000 = await vpToken.calculateVP(ethers.parseEther("10000"));
      expect(vp10000).to.equal(ethers.parseEther("10000"));
    });

    it('Should calculate base creation cost correctly with no active topics', async function () {
      const { topicFactory } = contracts;
      
      const cost = await topicFactory.quoteCreationCost();
      expect(cost).to.equal(ethers.parseEther("1000"));
    });

    it('Should calculate creation cost with active topics', async function () {
      const { topicFactory, vdotToken, vpToken } = contracts;
      
      const largeAmount = ethers.parseEther("10000");
      await vdotToken.connect(contracts.deployer).mint(owner.address, largeAmount);
      await vdotToken.connect(owner).approve(await vpToken.getAddress(), largeAmount);
      await vpToken.connect(owner).stakeVdot(largeAmount);
      
      const metadataHash1 = ethers.keccak256(ethers.toUtf8Bytes("Topic 1"));
      await topicFactory.connect(owner).createTopic(metadataHash1, DURATION, FREEZE_WINDOW, CURATED_LIMIT);
      
      const cost2 = await topicFactory.quoteCreationCost();
      expect(cost2).to.be.gt(ethers.parseEther("1000"));
      
      const metadataHash2 = ethers.keccak256(ethers.toUtf8Bytes("Topic 2"));
      await topicFactory.connect(owner).createTopic(metadataHash2, DURATION, FREEZE_WINDOW, CURATED_LIMIT);
      
      const cost3 = await topicFactory.quoteCreationCost();
      expect(cost3).to.be.gt(cost2);
    });
  });

  describe('Topic Creation', function () {
    beforeEach(async function () {
      // Setup: owner stakes vDOT and gets VP
      await createUserWithVP(contracts, owner, VDOT_AMOUNT);
    });

    it('Should create topic successfully', async function () {
      const { topicFactory, vpToken } = contracts;
      
      const initialVP = await vpToken.balanceOf(owner.address);
      const creationCost = await topicFactory.quoteCreationCost();
      
      const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("Web3 Future Development"));
      const expectedTopicId = await topicFactory.topicCounter() + 1n;
      
      // Check if the TopicCreated event is emitted with the correct values
      await expect(
        topicFactory.connect(owner).createTopic(
          metadataHash,
          DURATION,
          FREEZE_WINDOW,
          CURATED_LIMIT
        )
      )
        .to.emit(topicFactory, 'TopicCreated')
        .withArgs(expectedTopicId, owner.address, metadataHash, DURATION, FREEZE_WINDOW, CURATED_LIMIT);
      
      const finalVP = await vpToken.balanceOf(owner.address);
      expect(finalVP).to.equal(initialVP - creationCost);
      
      const topicId = await topicFactory.topicCounter();
      const topic = await topicFactory.getTopic(topicId);
      
      expect(topic.topicId).to.equal(topicId);
      expect(topic.creator).to.equal(owner.address);
      expect(topic.metadataHash).to.equal(metadataHash);
      expect(topic.duration).to.equal(DURATION);
      expect(topic.freezeWindow).to.equal(FREEZE_WINDOW);
      expect(topic.curatedLimit).to.equal(CURATED_LIMIT);
      expect(topic.status).to.equal(1);
      expect(topic.minted).to.be.false;
    });

    it('Should fail if VP balance is insufficient', async function () {
      const { topicFactory, vdotToken, vpToken } = contracts;
      
      const smallAmount = ethers.parseEther("100");
      await vdotToken.connect(contracts.deployer).mint(owner.address, smallAmount);
      await vdotToken.connect(owner).approve(await vpToken.getAddress(), smallAmount);
      await vpToken.connect(owner).stakeVdot(smallAmount);
      
      const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("Test Topic"));
      await expect(
        topicFactory.connect(owner).createTopic(
          metadataHash,
          DURATION,
          FREEZE_WINDOW,
          CURATED_LIMIT
        )
      ).to.be.revertedWith("TopicFactory: insufficient VP");
    });

    it('Should fail with invalid parameters', async function () {
      const { topicFactory } = contracts;
      const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("Test Topic"));
      
      await expect(
        topicFactory.connect(owner).createTopic(
          ethers.ZeroHash,
          DURATION,
          FREEZE_WINDOW,
          CURATED_LIMIT
        )
      ).to.be.revertedWith("TopicFactory: invalid metadata hash");
      
      await expect(
        topicFactory.connect(owner).createTopic(
          metadataHash,
          0,
          FREEZE_WINDOW,
          CURATED_LIMIT
        )
      ).to.be.revertedWith("TopicFactory: invalid duration");
      
      await expect(
        topicFactory.connect(owner).createTopic(
          metadataHash,
          DURATION,
          DURATION,
          CURATED_LIMIT
        )
      ).to.be.revertedWith("TopicFactory: invalid freeze window");
      
      await expect(
        topicFactory.connect(owner).createTopic(
          metadataHash,
          DURATION,
          FREEZE_WINDOW,
          0
        )
      ).to.be.revertedWith("TopicFactory: invalid curated limit");
      
      await expect(
        topicFactory.connect(owner).createTopic(
          metadataHash,
          DURATION,
          FREEZE_WINDOW,
          101
        )
      ).to.be.revertedWith("TopicFactory: invalid curated limit");
    });

    it('Should track active topic count correctly', async function () {
      const { topicFactory } = contracts;
      
      const activeCount1 = await topicFactory.activeTopicCount();
      expect(activeCount1).to.equal(0);
      
      // Create first topic
      await createTopic(contracts, owner, DURATION, FREEZE_WINDOW, CURATED_LIMIT);
      const activeCount2 = await topicFactory.activeTopicCount();
      expect(activeCount2).to.equal(1);
      
      // Create second topic
      await createTopic(contracts, owner, DURATION, FREEZE_WINDOW, CURATED_LIMIT);
      const activeCount3 = await topicFactory.activeTopicCount();
      expect(activeCount3).to.equal(2);
    });

    it('Should register user participation in topic', async function () {
      const { topicFactory } = contracts;
      
      const topicId = await createTopic(contracts, owner, DURATION, FREEZE_WINDOW, CURATED_LIMIT);
      
      const participated = await topicFactory.userParticipated(topicId, owner.address);
      expect(participated).to.be.true;
      
      const userTopics = await topicFactory.getUserTopics(owner.address);
      expect(userTopics).to.include(topicId);
    });
  });
});
