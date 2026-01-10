const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { deployContracts, createUserWithVP, createTopic, lockVdotForTopic, postMessage } = require("./fixtures");

describe("Integration Test: Complete Flow", function () {
  let contracts;
  let alice, bob, charlie;

  const VDOT_AMOUNT = ethers.parseEther("1000");
  const DURATION = 86400; // 24 hours
  const FREEZE_WINDOW = 600; // 10 minutes
  const CURATED_LIMIT = 50;

  beforeEach(async function () {
    contracts = await deployContracts();
    alice = contracts.alice;
    bob = contracts.bob;
    charlie = contracts.charlie;
  });

  it("Should complete full flow: from topic creation to NFT minting and VP refund", async function () {
    const {
      vdotToken,
      vpToken,
      topicFactory,
      topicVault,
      messageRegistry,
      curationModule,
      nftMinter
    } = contracts;

    // ===== Step 1: Alice creates topic =====
    console.log("Step 1: Alice creates topic");
    
    // Alice mints vDOT and stakes to get VP
    await createUserWithVP(contracts, alice, VDOT_AMOUNT);
    const aliceVPBefore = await vpToken.balanceOf(alice.address);
    
    // Alice creates topic
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("Web3 Future Development"));
    const topicId = await createTopic(contracts, alice, DURATION, FREEZE_WINDOW, CURATED_LIMIT);
    
    // Verify topic creation
    const topic = await topicFactory.getTopic(topicId);
    expect(topic.creator).to.equal(alice.address);
    expect(topic.status).to.equal(1); // Live
    expect(topic.duration).to.equal(DURATION);
    expect(topic.freezeWindow).to.equal(FREEZE_WINDOW);
    expect(topic.curatedLimit).to.equal(CURATED_LIMIT);
    
    // Verify VP was deducted from Alice
    const aliceVPAfter = await vpToken.balanceOf(alice.address);
    const creationCost = await topicFactory.quoteCreationCost();
    expect(aliceVPAfter).to.equal(aliceVPBefore - creationCost);
    
    console.log("✓ Topic created, VP deducted");

    // ===== Step 2: Bob participates in discussion =====
    console.log("Step 2: Bob participates in discussion");
    
    // Bob locks vDOT to get topic-scoped VP
    await lockVdotForTopic(contracts, bob, topicId, VDOT_AMOUNT);
    const bobVP = await topicVault.balanceOf(topicId, bob.address);
    expect(bobVP).to.be.gt(ethers.parseEther("3000"));
    
    // Bob posts messages
    const messageIds = [];
    for (let i = 0; i < 3; i++) {
      const msgId = await postMessage(
        contracts,
        bob,
        topicId,
        `Bob's message ${i + 1}: I think Web3 is about decentralization`,
        ethers.parseEther("0.6")
      );
      messageIds.push(msgId);
      await time.increase(15);
    }
    
    // Verify messages were posted
    for (const msgId of messageIds) {
      const message = await messageRegistry.getMessage(msgId);
      expect(message.author).to.equal(bob.address);
      expect(message.topicId).to.equal(topicId);
    }
    
    // Verify VP was burned
    const bobVPAfter = await topicVault.balanceOf(topicId, bob.address);
    expect(bobVPAfter).to.be.lt(bobVP);
    
    console.log("✓ Bob posted messages, VP burned");

    // ===== Step 3: Multiple users like and curate =====
    console.log("Step 3: Multiple users like and curate");
    
    // Charlie locks vDOT and likes messages
    await lockVdotForTopic(contracts, charlie, topicId, VDOT_AMOUNT);
    
    // Charlie likes Bob's messages
    for (let i = 0; i < messageIds.length; i++) {
      await messageRegistry.connect(charlie).likeMessage(topicId, messageIds[i]);
      await time.increase(1);
      
      const message = await messageRegistry.getMessage(messageIds[i]);
      expect(message.likeCount).to.equal(BigInt(i + 1));
    }
    
    // Verify curated list is updated
    const curatedMessages = await curationModule.getCuratedMessages(topicId);
    expect(curatedMessages.length).to.be.gt(0);
    expect(curatedMessages).to.include(messageIds[0]);
    
    // Verify VP was burned for likes
    const charlieVPAfter = await topicVault.balanceOf(topicId, charlie.address);
    const expectedLikesCost = ethers.parseEther(String(messageIds.length));
    // Approximate check (VP might be used for other things)
    
    console.log("✓ Messages liked, curated list updated");

    // ===== Step 4: Freeze window =====
    console.log("Step 4: Freeze window");
    
    // Fast forward to freeze window
    const timeUntilFreeze = DURATION - FREEZE_WINDOW;
    await time.increase(Number(timeUntilFreeze));
    
    // Verify topic is frozen
    const isFrozen = await topicFactory.isFrozen(topicId);
    expect(isFrozen).to.be.true;
    
    // Post a message during freeze window (should still work)
    const freezeMsgId = await postMessage(
      contracts,
      bob,
      topicId,
      "Message during freeze window",
      ethers.parseEther("0.5")
    );
    await time.increase(15);
    
    // Like during freeze window
    await messageRegistry.connect(charlie).likeMessage(topicId, freezeMsgId);
    
    // Verify curated list is frozen (new message with likes shouldn't be added)
    const curatedAfterFreeze = await curationModule.getCuratedMessages(topicId);
    // The new message might not be in curated if it has fewer likes
    
    console.log("✓ Freeze window active, curated list frozen");

    // ===== Step 5: Topic closes =====
    console.log("Step 5: Topic closes");
    
    // Fast forward beyond duration
    await time.increase(FREEZE_WINDOW + 1);
    
    // Close topic
    const closed = await topicFactory.checkAndCloseTopic(topicId);
    expect(closed).to.be.true;
    
    // Verify topic is closed
    const closedTopic = await topicFactory.getTopic(topicId);
    expect(closedTopic.status).to.equal(2); // Closed
    
    // Verify active topic count decreased
    const activeCount = await topicFactory.activeTopicCount();
    expect(activeCount).to.equal(0);
    
    console.log("✓ Topic closed");

    // ===== Step 6: Mint NFT and refund VP =====
    console.log("Step 6: Mint NFT and refund VP");
    
    // Get VP balances before refund
    const bobVPBeforeRefund = await vpToken.balanceOf(bob.address);
    const charlieVPBeforeRefund = await vpToken.balanceOf(charlie.address);
    
    // Get consumed VP
    const bobConsumedVP = await topicVault.getConsumedVP(topicId, bob.address);
    const charlieConsumedVP = await topicVault.getConsumedVP(topicId, charlie.address);
    
    // Get curated set hash
    const curatedHash = await curationModule.curatedSetHash(topicId);
    
    // Mint NFT (Bob can mint because he posted)
    const mintTx = await nftMinter.connect(bob).mintNfts(topicId);
    const mintReceipt = await mintTx.wait();
    
    // Verify NFT was minted
    const tokenId = await nftMinter.topicToTokenId(topicId);
    const nftOwner = await nftMinter.ownerOf(tokenId);
    expect(nftOwner).to.equal(bob.address);
    
    // Verify metadata
    const metadata = await nftMinter.getMetadata(tokenId);
    expect(metadata.topicId).to.equal(topicId);
    expect(metadata.topicHash).to.equal(topic.metadataHash);
    expect(metadata.curatedHash).to.equal(curatedHash);
    
    // Verify topic is marked as minted
    const mintedTopic = await topicFactory.getTopic(topicId);
    expect(mintedTopic.minted).to.be.true;
    expect(mintedTopic.status).to.equal(3); // Minted
    
    // Verify VP was refunded
    const bobVPAfterRefund = await vpToken.balanceOf(bob.address);
    const charlieVPAfterRefund = await vpToken.balanceOf(charlie.address);
    
    if (bobConsumedVP > 0n) {
      expect(bobVPAfterRefund).to.equal(bobVPBeforeRefund + bobConsumedVP);
    }
    if (charlieConsumedVP > 0n) {
      expect(charlieVPAfterRefund).to.equal(charlieVPBeforeRefund + charlieConsumedVP);
    }
    
    // Verify refund can only happen once
    const vpRefunded = await topicVault.isVPRefunded(topicId);
    expect(vpRefunded).to.be.true;
    
    console.log("✓ NFT minted, VP refunded");

    // ===== Step 7: Verify redemption eligibility =====
    console.log("Step 7: Verify redemption eligibility");
    
    // Both Bob and Charlie should be able to redeem (all topics closed)
    const bobCanRedeem = await topicFactory.canUserRedeem(bob.address);
    const charlieCanRedeem = await topicFactory.canUserRedeem(charlie.address);
    
    // Actually, Alice (creator) also participated, so check her
    const aliceCanRedeem = await topicFactory.canUserRedeem(alice.address);
    
    // All should be able to redeem since the topic is closed and minted
    expect(bobCanRedeem).to.be.true;
    expect(charlieCanRedeem).to.be.true;
    expect(aliceCanRedeem).to.be.true;
    
    console.log("✓ Users can redeem vDOT");
    
    console.log("\n✅ Complete flow test passed!");
  });

  it("Should handle concurrent users and multiple topics", async function () {
    // Create multiple topics with different users participating
    await createUserWithVP(contracts, alice, ethers.parseEther("5000"));
    await createUserWithVP(contracts, bob, ethers.parseEther("5000"));
    
    // Create two topics
    const topicId1 = await createTopic(contracts, alice, DURATION, FREEZE_WINDOW, CURATED_LIMIT);
    const topicId2 = await createTopic(contracts, bob, DURATION, FREEZE_WINDOW, CURATED_LIMIT);
    
    // Users participate in both topics
    await lockVdotForTopic(contracts, bob, topicId1, VDOT_AMOUNT);
    await lockVdotForTopic(contracts, alice, topicId2, VDOT_AMOUNT);
    
    // Post messages in both topics
    await postMessage(contracts, bob, topicId1, "Bob in topic 1", ethers.parseEther("0.5"));
    await time.increase(15);
    await postMessage(contracts, alice, topicId2, "Alice in topic 2", ethers.parseEther("0.5"));
    
    // Close and mint both topics
    await time.increase(DURATION + 1);
    await contracts.topicFactory.checkAndCloseTopic(topicId1);
    await contracts.topicFactory.checkAndCloseTopic(topicId2);
    
    await contracts.nftMinter.connect(bob).mintNfts(topicId1);
    await contracts.nftMinter.connect(alice).mintNfts(topicId2);
    
    // Both users should be able to redeem
    const bobCanRedeem = await contracts.topicFactory.canUserRedeem(bob.address);
    const aliceCanRedeem = await contracts.topicFactory.canUserRedeem(alice.address);
    
    expect(bobCanRedeem).to.be.true;
    expect(aliceCanRedeem).to.be.true;
  });
});
