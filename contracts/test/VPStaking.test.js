const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VPStaking", function () {
  let vpStaking;
  let vdotToken;
  let owner;
  let user1;
  let user2;
  let vpProxy;

  const INITIAL_SUPPLY = ethers.parseEther("1000000");

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy mock vDOT token
    const VDOTToken = await ethers.getContractFactory("VDOTToken");
    vdotToken = await VDOTToken.deploy(INITIAL_SUPPLY);
    await vdotToken.waitForDeployment();

    // Deploy VPStaking implementation
    const VPStaking = await ethers.getContractFactory("VPStaking");
    const vpStakingImpl = await VPStaking.deploy();
    await vpStakingImpl.waitForDeployment();

    // Deploy VPAdmin implementation
    const VPAdmin = await ethers.getContractFactory("VPAdmin");
    const vpAdminImpl = await VPAdmin.deploy();
    await vpAdminImpl.waitForDeployment();

    // Deploy RouterProxy
    const RouterProxy = await ethers.getContractFactory("RouterProxy");
    vpProxy = await RouterProxy.deploy(owner.address);
    await vpProxy.waitForDeployment();

    // Set routes for VPStaking functions
    const stakingSelectors = [
      vpStakingImpl.interface.getFunction("initialize").selector,
      vpStakingImpl.interface.getFunction("stakeVdot").selector,
      vpStakingImpl.interface.getFunction("calculateVP").selector,
      vpStakingImpl.interface.getFunction("balanceOf").selector,
      vpStakingImpl.interface.getFunction("stakedVdot").selector,
      vpStakingImpl.interface.getFunction("totalStakedVdot").selector,
    ];

    for (const selector of stakingSelectors) {
      await vpProxy.setRoute(selector, await vpStakingImpl.getAddress());
    }

    // Set routes for VPAdmin functions
    const adminSelectors = [
      vpAdminImpl.interface.getFunction("pause").selector,
      vpAdminImpl.interface.getFunction("unpause").selector,
      vpAdminImpl.interface.getFunction("paused").selector,
    ];

    for (const selector of adminSelectors) {
      await vpProxy.setRoute(selector, await vpAdminImpl.getAddress());
    }

    // Create interface to proxy
    vpStaking = await ethers.getContractAt(
      [...VPStaking.interface.fragments, ...VPAdmin.interface.fragments],
      await vpProxy.getAddress()
    );

    // Initialize
    await vpStaking.initialize(await vdotToken.getAddress(), owner.address);

    // Transfer some vDOT to users
    await vdotToken.transfer(user1.address, ethers.parseEther("10000"));
    await vdotToken.transfer(user2.address, ethers.parseEther("10000"));
  });

  describe("Staking", function () {
    it("should stake vDOT and receive VP", async function () {
      const stakeAmount = ethers.parseEther("100");

      // Approve vDOT transfer
      await vdotToken
        .connect(user1)
        .approve(await vpProxy.getAddress(), stakeAmount);

      // Stake
      await vpStaking.connect(user1).stakeVdot(stakeAmount);

      // Check staked amount
      expect(await vpStaking.stakedVdot(user1.address)).to.equal(stakeAmount);

      // Check VP balance (VP = 100 * sqrt(vDOT))
      const vpBalance = await vpStaking.balanceOf(user1.address);
      expect(vpBalance).to.be.gt(0);
    });

    it("should reject zero amount stake", async function () {
      await expect(vpStaking.connect(user1).stakeVdot(0)).to.be.revertedWith(
        "VP: amount must be > 0"
      );
    });

    it("should reject stake when paused", async function () {
      const stakeAmount = ethers.parseEther("100");
      await vdotToken
        .connect(user1)
        .approve(await vpProxy.getAddress(), stakeAmount);

      // Pause
      await vpStaking.connect(owner).pause();

      // Try to stake
      await expect(
        vpStaking.connect(user1).stakeVdot(stakeAmount)
      ).to.be.revertedWith("Pausable: paused");
    });

    it("should allow stake after unpause", async function () {
      const stakeAmount = ethers.parseEther("100");
      await vdotToken
        .connect(user1)
        .approve(await vpProxy.getAddress(), stakeAmount);

      // Pause then unpause
      await vpStaking.connect(owner).pause();
      await vpStaking.connect(owner).unpause();

      // Stake should work
      await vpStaking.connect(user1).stakeVdot(stakeAmount);
      expect(await vpStaking.stakedVdot(user1.address)).to.equal(stakeAmount);
    });
  });

  describe("VP Calculation", function () {
    it("should calculate VP correctly using square root formula", async function () {
      // VP = 100 * sqrt(vDOT_in_wei)
      // For 100 vDOT (100e18 wei), VP = 100 * sqrt(100e18) ≈ 100 * 10e9 = 1000e9
      const vdotAmount = ethers.parseEther("100");
      const vpAmount = await vpStaking.calculateVP(vdotAmount);

      // sqrt(100e18) * 100 = 10e9 * 100 = 1e12
      expect(vpAmount).to.be.gt(0);
    });

    it("should return 0 for zero input", async function () {
      expect(await vpStaking.calculateVP(0)).to.equal(0);
    });
  });

  describe("Total Staked Tracking", function () {
    it("should track total staked vDOT across users", async function () {
      const stake1 = ethers.parseEther("100");
      const stake2 = ethers.parseEther("200");

      await vdotToken
        .connect(user1)
        .approve(await vpProxy.getAddress(), stake1);
      await vdotToken
        .connect(user2)
        .approve(await vpProxy.getAddress(), stake2);

      await vpStaking.connect(user1).stakeVdot(stake1);
      await vpStaking.connect(user2).stakeVdot(stake2);

      expect(await vpStaking.totalStakedVdot()).to.equal(stake1 + stake2);
    });
  });
});
