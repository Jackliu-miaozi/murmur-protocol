const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VPSettlement", function () {
  let vpSettlement;
  let vpStaking;
  let vdotToken;
  let owner;
  let operator;
  let user1;
  let user2;
  let user3;
  let vpProxy;

  const INITIAL_SUPPLY = ethers.parseEther("1000000");

  // Helper to sign settlement
  async function signSettlement(signer, users, deltas, nonce, proxyAddress) {
    const domain = {
      name: "MurmurVPToken",
      version: "3",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: proxyAddress,
    };

    const types = {
      Settlement: [
        { name: "users", type: "address[]" },
        { name: "deltas", type: "int256[]" },
        { name: "nonce", type: "uint256" },
      ],
    };

    const value = { users, deltas, nonce };

    return await signer.signTypedData(domain, types, value);
  }

  beforeEach(async function () {
    [owner, operator, user1, user2, user3] = await ethers.getSigners();

    // Deploy mock vDOT token
    const VDOTToken = await ethers.getContractFactory("VDOTToken");
    vdotToken = await VDOTToken.deploy(INITIAL_SUPPLY);
    await vdotToken.waitForDeployment();

    // Deploy implementations
    const VPStaking = await ethers.getContractFactory("VPStaking");
    const vpStakingImpl = await VPStaking.deploy();

    const VPSettlement = await ethers.getContractFactory("VPSettlement");
    const vpSettlementImpl = await VPSettlement.deploy();

    const VPAdmin = await ethers.getContractFactory("VPAdmin");
    const vpAdminImpl = await VPAdmin.deploy();

    // Deploy RouterProxy
    const RouterProxy = await ethers.getContractFactory("RouterProxy");
    vpProxy = await RouterProxy.deploy(owner.address);
    await vpProxy.waitForDeployment();

    // Set routes
    const proxyAddr = await vpProxy.getAddress();

    // VPStaking routes
    for (const fn of ["initialize", "stakeVdot", "balanceOf", "stakedVdot"]) {
      await vpProxy.setRoute(
        vpStakingImpl.interface.getFunction(fn).selector,
        await vpStakingImpl.getAddress()
      );
    }

    // VPSettlement routes
    for (const fn of ["settleBalances", "settlementNonce", "domainSeparator"]) {
      await vpProxy.setRoute(
        vpSettlementImpl.interface.getFunction(fn).selector,
        await vpSettlementImpl.getAddress()
      );
    }

    // VPAdmin routes
    for (const fn of [
      "setOperator",
      "isOperator",
      "pause",
      "unpause",
      "paused",
    ]) {
      await vpProxy.setRoute(
        vpAdminImpl.interface.getFunction(fn).selector,
        await vpAdminImpl.getAddress()
      );
    }

    // Create combined interface
    const combinedAbi = [
      ...VPStaking.interface.fragments,
      ...VPSettlement.interface.fragments,
      ...VPAdmin.interface.fragments,
    ];
    vpSettlement = await ethers.getContractAt(combinedAbi, proxyAddr);
    vpStaking = vpSettlement;

    // Initialize
    await vpSettlement.initialize(await vdotToken.getAddress(), owner.address);

    // Set operator
    await vpSettlement.setOperator(operator.address, true);

    // Give users some vDOT and stake
    for (const user of [user1, user2, user3]) {
      await vdotToken.transfer(user.address, ethers.parseEther("1000"));
      await vdotToken
        .connect(user)
        .approve(proxyAddr, ethers.parseEther("100"));
      await vpStaking.connect(user).stakeVdot(ethers.parseEther("100"));
    }
  });

  describe("Settlement", function () {
    it("should settle balances with valid signature", async function () {
      const users = [user1.address, user2.address];
      const deltas = [BigInt(-100), BigInt(50)]; // user1 loses 100, user2 gains 50
      const nonce = await vpSettlement.settlementNonce();
      const proxyAddr = await vpProxy.getAddress();

      const signature = await signSettlement(
        operator,
        users,
        deltas,
        nonce,
        proxyAddr
      );

      const balanceBefore1 = await vpSettlement.balanceOf(user1.address);
      const balanceBefore2 = await vpSettlement.balanceOf(user2.address);

      await expect(vpSettlement.settleBalances(users, deltas, nonce, signature))
        .to.emit(vpSettlement, "VPBalanceChanged")
        .to.emit(vpSettlement, "SettlementExecuted");

      expect(await vpSettlement.balanceOf(user1.address)).to.equal(
        balanceBefore1 - BigInt(100)
      );
      expect(await vpSettlement.balanceOf(user2.address)).to.equal(
        balanceBefore2 + BigInt(50)
      );
    });

    it("should reject invalid signature", async function () {
      const users = [user1.address];
      const deltas = [BigInt(-100)];
      const nonce = await vpSettlement.settlementNonce();
      const proxyAddr = await vpProxy.getAddress();

      // Sign with non-operator
      const signature = await signSettlement(
        user1,
        users,
        deltas,
        nonce,
        proxyAddr
      );

      await expect(
        vpSettlement.settleBalances(users, deltas, nonce, signature)
      ).to.be.revertedWith("VP: invalid signature");
    });

    it("should reject replay attack (wrong nonce)", async function () {
      const users = [user1.address];
      const deltas = [BigInt(-100)];
      const wrongNonce = 999n;
      const proxyAddr = await vpProxy.getAddress();

      const signature = await signSettlement(
        operator,
        users,
        deltas,
        wrongNonce,
        proxyAddr
      );

      await expect(
        vpSettlement.settleBalances(users, deltas, wrongNonce, signature)
      ).to.be.revertedWith("VP: invalid nonce");
    });

    it("should reject batch too large", async function () {
      // Create 201 users (exceeds MAX_SETTLEMENT_BATCH of 200)
      const users = [];
      const deltas = [];
      for (let i = 0; i < 201; i++) {
        users.push(ethers.Wallet.createRandom().address);
        deltas.push(BigInt(1));
      }
      const nonce = await vpSettlement.settlementNonce();
      const proxyAddr = await vpProxy.getAddress();

      const signature = await signSettlement(
        operator,
        users,
        deltas,
        nonce,
        proxyAddr
      );

      await expect(
        vpSettlement.settleBalances(users, deltas, nonce, signature)
      ).to.be.revertedWith("VP: batch too large");
    });

    it("should reject when paused", async function () {
      const users = [user1.address];
      const deltas = [BigInt(-100)];
      const nonce = await vpSettlement.settlementNonce();
      const proxyAddr = await vpProxy.getAddress();

      const signature = await signSettlement(
        operator,
        users,
        deltas,
        nonce,
        proxyAddr
      );

      await vpSettlement.pause();

      await expect(
        vpSettlement.settleBalances(users, deltas, nonce, signature)
      ).to.be.revertedWith("Pausable: paused");
    });

    it("should emit VPBalanceChanged for each user", async function () {
      const users = [user1.address, user2.address, user3.address];
      const deltas = [BigInt(-50), BigInt(100), BigInt(-25)];
      const nonce = await vpSettlement.settlementNonce();
      const proxyAddr = await vpProxy.getAddress();

      const signature = await signSettlement(
        operator,
        users,
        deltas,
        nonce,
        proxyAddr
      );

      const tx = await vpSettlement.settleBalances(
        users,
        deltas,
        nonce,
        signature
      );
      const receipt = await tx.wait();

      // Should have 3 VPBalanceChanged events + 1 SettlementExecuted
      const balanceChangedEvents = receipt.logs.filter(
        (log) => log.fragment?.name === "VPBalanceChanged"
      );
      expect(balanceChangedEvents.length).to.equal(3);
    });
  });

  describe("Nonce Management", function () {
    it("should increment nonce after settlement", async function () {
      const nonceBefore = await vpSettlement.settlementNonce();

      const users = [user1.address];
      const deltas = [BigInt(-10)];
      const proxyAddr = await vpProxy.getAddress();
      const signature = await signSettlement(
        operator,
        users,
        deltas,
        nonceBefore,
        proxyAddr
      );

      await vpSettlement.settleBalances(users, deltas, nonceBefore, signature);

      expect(await vpSettlement.settlementNonce()).to.equal(nonceBefore + 1n);
    });
  });
});
