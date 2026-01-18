const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NFT Modules", function () {
  let nftMint;
  let nftQuery;
  let nftApproval;
  let nftAdmin;
  let owner;
  let operator;
  let user1;
  let user2;
  let nftProxy;

  const MINT_FEE = ethers.parseEther("0.1");

  // Helper to sign mint
  async function signMint(signer, topicId, ipfsHash, nonce, proxyAddress) {
    const domain = {
      name: "MurmurNFT",
      version: "3",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: proxyAddress,
    };

    const types = {
      MintNFT: [
        { name: "topicId", type: "uint256" },
        { name: "ipfsHash", type: "bytes32" },
        { name: "nonce", type: "uint256" },
      ],
    };

    const value = { topicId, ipfsHash, nonce };

    return await signer.signTypedData(domain, types, value);
  }

  beforeEach(async function () {
    [owner, operator, user1, user2] = await ethers.getSigners();

    // Deploy implementations
    const NFTMint = await ethers.getContractFactory("NFTMint");
    const nftMintImpl = await NFTMint.deploy();

    const NFTQuery = await ethers.getContractFactory("NFTQuery");
    const nftQueryImpl = await NFTQuery.deploy();

    const NFTApproval = await ethers.getContractFactory("NFTApproval");
    const nftApprovalImpl = await NFTApproval.deploy();

    const NFTAdmin = await ethers.getContractFactory("NFTAdmin");
    const nftAdminImpl = await NFTAdmin.deploy();

    // Deploy RouterProxy
    const RouterProxy = await ethers.getContractFactory("RouterProxy");
    nftProxy = await RouterProxy.deploy(owner.address);
    await nftProxy.waitForDeployment();

    const proxyAddr = await nftProxy.getAddress();

    // Set routes for NFTMint
    for (const fn of [
      "initialize",
      "mintWithSignature",
      "mintNonce",
      "topicMinted",
      "domainSeparator",
    ]) {
      await nftProxy.setRoute(
        nftMintImpl.interface.getFunction(fn).selector,
        await nftMintImpl.getAddress()
      );
    }

    // Set routes for NFTQuery
    for (const fn of [
      "ownerOf",
      "balanceOf",
      "tokenURI",
      "tokenTopic",
      "tokenIPFS",
      "name",
      "symbol",
      "supportsInterface",
      "transfer",
      "transferFrom",
    ]) {
      await nftProxy.setRoute(
        nftQueryImpl.interface.getFunction(fn).selector,
        await nftQueryImpl.getAddress()
      );
    }

    // safeTransferFrom has overloads
    await nftProxy.setRoute(
      nftQueryImpl.interface.getFunction(
        "safeTransferFrom(address,address,uint256)"
      ).selector,
      await nftQueryImpl.getAddress()
    );
    await nftProxy.setRoute(
      nftQueryImpl.interface.getFunction(
        "safeTransferFrom(address,address,uint256,bytes)"
      ).selector,
      await nftQueryImpl.getAddress()
    );

    // Set routes for NFTApproval
    for (const fn of [
      "approve",
      "getApproved",
      "setApprovalForAll",
      "isApprovedForAll",
    ]) {
      await nftProxy.setRoute(
        nftApprovalImpl.interface.getFunction(fn).selector,
        await nftApprovalImpl.getAddress()
      );
    }

    // Set routes for NFTAdmin
    for (const fn of [
      "setOperator",
      "isOperator",
      "nftOwner",
      "pause",
      "unpause",
      "paused",
      "totalSupply",
    ]) {
      await nftProxy.setRoute(
        nftAdminImpl.interface.getFunction(fn).selector,
        await nftAdminImpl.getAddress()
      );
    }

    // Create combined interface
    const combinedAbi = [
      ...NFTMint.interface.fragments,
      ...NFTQuery.interface.fragments,
      ...NFTApproval.interface.fragments,
      ...NFTAdmin.interface.fragments,
    ];

    const nft = await ethers.getContractAt(combinedAbi, proxyAddr);
    nftMint = nft;
    nftQuery = nft;
    nftApproval = nft;
    nftAdmin = nft;

    // Initialize
    await nft.initialize(owner.address);
    await nft.setOperator(operator.address, true);
  });

  describe("NFTMint", function () {
    it("should mint NFT with valid signature", async function () {
      const topicId = 1;
      const ipfsHash = ethers.keccak256(ethers.toUtf8Bytes("test-content"));
      const nonce = await nftMint.mintNonce();
      const proxyAddr = await nftProxy.getAddress();

      const signature = await signMint(
        operator,
        topicId,
        ipfsHash,
        nonce,
        proxyAddr
      );

      await expect(
        nftMint
          .connect(user1)
          .mintWithSignature(topicId, ipfsHash, nonce, signature, {
            value: MINT_FEE,
          })
      )
        .to.emit(nftMint, "NFTMinted")
        .to.emit(nftMint, "Transfer");

      expect(await nftQuery.ownerOf(0)).to.equal(user1.address);
      expect(await nftQuery.balanceOf(user1.address)).to.equal(1);
    });

    it("should reject duplicate minting for same topic", async function () {
      const topicId = 1;
      const ipfsHash = ethers.keccak256(ethers.toUtf8Bytes("test-content"));
      const nonce = await nftMint.mintNonce();
      const proxyAddr = await nftProxy.getAddress();

      let signature = await signMint(
        operator,
        topicId,
        ipfsHash,
        nonce,
        proxyAddr
      );
      await nftMint
        .connect(user1)
        .mintWithSignature(topicId, ipfsHash, nonce, signature, {
          value: MINT_FEE,
        });

      // Try to mint again
      const nonce2 = await nftMint.mintNonce();
      signature = await signMint(
        operator,
        topicId,
        ipfsHash,
        nonce2,
        proxyAddr
      );

      await expect(
        nftMint
          .connect(user2)
          .mintWithSignature(topicId, ipfsHash, nonce2, signature, {
            value: MINT_FEE,
          })
      ).to.be.revertedWith("NFT: already minted");
    });

    it("should reject insufficient fee", async function () {
      const topicId = 1;
      const ipfsHash = ethers.keccak256(ethers.toUtf8Bytes("test-content"));
      const nonce = await nftMint.mintNonce();
      const proxyAddr = await nftProxy.getAddress();

      const signature = await signMint(
        operator,
        topicId,
        ipfsHash,
        nonce,
        proxyAddr
      );

      await expect(
        nftMint
          .connect(user1)
          .mintWithSignature(topicId, ipfsHash, nonce, signature, {
            value: MINT_FEE - 1n,
          })
      ).to.be.revertedWith("NFT: insufficient fee");
    });

    it("should refund excess payment", async function () {
      const topicId = 1;
      const ipfsHash = ethers.keccak256(ethers.toUtf8Bytes("test-content"));
      const nonce = await nftMint.mintNonce();
      const proxyAddr = await nftProxy.getAddress();

      const signature = await signMint(
        operator,
        topicId,
        ipfsHash,
        nonce,
        proxyAddr
      );
      const excessAmount = ethers.parseEther("0.5");

      const balanceBefore = await ethers.provider.getBalance(user1.address);

      const tx = await nftMint
        .connect(user1)
        .mintWithSignature(topicId, ipfsHash, nonce, signature, {
          value: MINT_FEE + excessAmount,
        });
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(user1.address);

      // User should only have paid MINT_FEE + gas
      expect(balanceBefore - balanceAfter - gasUsed).to.equal(MINT_FEE);
    });

    it("should reject when paused", async function () {
      await nftAdmin.pause();

      const topicId = 1;
      const ipfsHash = ethers.keccak256(ethers.toUtf8Bytes("test-content"));
      const nonce = await nftMint.mintNonce();
      const proxyAddr = await nftProxy.getAddress();

      const signature = await signMint(
        operator,
        topicId,
        ipfsHash,
        nonce,
        proxyAddr
      );

      await expect(
        nftMint
          .connect(user1)
          .mintWithSignature(topicId, ipfsHash, nonce, signature, {
            value: MINT_FEE,
          })
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("NFTQuery - ERC721 Compliance", function () {
    let tokenId;

    beforeEach(async function () {
      // Mint a token first
      const topicId = 1;
      const ipfsHash = ethers.keccak256(ethers.toUtf8Bytes("test-content"));
      const nonce = await nftMint.mintNonce();
      const proxyAddr = await nftProxy.getAddress();

      const signature = await signMint(
        operator,
        topicId,
        ipfsHash,
        nonce,
        proxyAddr
      );
      await nftMint
        .connect(user1)
        .mintWithSignature(topicId, ipfsHash, nonce, signature, {
          value: MINT_FEE,
        });
      tokenId = 0;
    });

    it("should return correct name and symbol", async function () {
      expect(await nftQuery.name()).to.equal("Murmur Memory");
      expect(await nftQuery.symbol()).to.equal("MURMUR");
    });

    it("should support ERC-721 interface", async function () {
      const ERC721_INTERFACE_ID = "0x80ac58cd";
      const ERC165_INTERFACE_ID = "0x01ffc9a7";

      expect(await nftQuery.supportsInterface(ERC721_INTERFACE_ID)).to.be.true;
      expect(await nftQuery.supportsInterface(ERC165_INTERFACE_ID)).to.be.true;
    });

    it("should transfer token", async function () {
      await nftQuery.connect(user1).transfer(user2.address, tokenId);
      expect(await nftQuery.ownerOf(tokenId)).to.equal(user2.address);
    });

    it("should transferFrom with approval", async function () {
      await nftApproval.connect(user1).approve(user2.address, tokenId);
      await nftQuery
        .connect(user2)
        .transferFrom(user1.address, user2.address, tokenId);
      expect(await nftQuery.ownerOf(tokenId)).to.equal(user2.address);
    });
  });

  describe("NFTApproval", function () {
    let tokenId;

    beforeEach(async function () {
      const topicId = 1;
      const ipfsHash = ethers.keccak256(ethers.toUtf8Bytes("test-content"));
      const nonce = await nftMint.mintNonce();
      const proxyAddr = await nftProxy.getAddress();

      const signature = await signMint(
        operator,
        topicId,
        ipfsHash,
        nonce,
        proxyAddr
      );
      await nftMint
        .connect(user1)
        .mintWithSignature(topicId, ipfsHash, nonce, signature, {
          value: MINT_FEE,
        });
      tokenId = 0;
    });

    it("should approve and get approved", async function () {
      await nftApproval.connect(user1).approve(user2.address, tokenId);
      expect(await nftApproval.getApproved(tokenId)).to.equal(user2.address);
    });

    it("should set approval for all", async function () {
      await nftApproval.connect(user1).setApprovalForAll(user2.address, true);
      expect(await nftApproval.isApprovedForAll(user1.address, user2.address))
        .to.be.true;
    });

    it("should reject approval from non-owner", async function () {
      await expect(
        nftApproval.connect(user2).approve(user2.address, tokenId)
      ).to.be.revertedWith("NFT: not owner or approved");
    });

    it("should clear approval on transfer", async function () {
      await nftApproval.connect(user1).approve(user2.address, tokenId);
      await nftQuery.connect(user1).transfer(user2.address, tokenId);
      expect(await nftApproval.getApproved(tokenId)).to.equal(
        ethers.ZeroAddress
      );
    });
  });

  describe("NFTAdmin - Two-Step Ownership", function () {
    it("should transfer ownership in two steps", async function () {
      await nftAdmin.transferOwnership(user1.address);
      expect(await nftAdmin.nftOwner()).to.equal(owner.address); // Still old owner

      await nftAdmin.connect(user1).acceptOwnership();
      expect(await nftAdmin.nftOwner()).to.equal(user1.address);
    });

    it("should reject accept from non-pending owner", async function () {
      await nftAdmin.transferOwnership(user1.address);
      await expect(
        nftAdmin.connect(user2).acceptOwnership()
      ).to.be.revertedWith("NFT: not pending owner");
    });
  });
});
