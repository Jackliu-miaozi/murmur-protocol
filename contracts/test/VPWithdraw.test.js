const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("VPWithdraw", function () {
  let vpWithdraw;
  let vdotToken;
  let owner;
  let operator;
  let user1;
  let vpProxy;

  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const SEVEN_DAYS = 7 * 24 * 60 * 60;

  // Helper to sign withdrawal
  async function signWithdrawal(
    signer,
    user,
    vpBurnAmount,
    vdotReturn,
    nonce,
    proxyAddress
  ) {
    const domain = {
      name: "MurmurVPToken",
      version: "3",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: proxyAddress,
    };

    const types = {
      Withdraw: [
        { name: "user", type: "address" },
        { name: "vpBurnAmount", type: "uint256" },
        { name: "vdotReturn", type: "uint256" },
        { name: "nonce", type: "uint256" },
      ],
    };

    const value = { user, vpBurnAmount, vdotReturn, nonce };

    return await signer.signTypedData(domain, types, value);
  }

  beforeEach(async function () {
    [owner, operator, user1] = await ethers.getSigners();

    // Deploy mock vDOT token
    const VDOTToken = await ethers.getContractFactory("VDOTToken");
    vdotToken = await VDOTToken.deploy(INITIAL_SUPPLY);
    await vdotToken.waitForDeployment();

    // Deploy implementations
    const VPStaking = await ethers.getContractFactory("VPStaking");
    const vpStakingImpl = await VPStaking.deploy();

    const VPWithdraw = await ethers.getContractFactory("VPWithdraw");
    const vpWithdrawImpl = await VPWithdraw.deploy();

    const VPAdmin = await ethers.getContractFactory("VPAdmin");
    const vpAdminImpl = await VPAdmin.deploy();

    // Deploy RouterProxy
    const RouterProxy = await ethers.getContractFactory("RouterProxy");
    vpProxy = await RouterProxy.deploy(owner.address);
    await vpProxy.waitForDeployment();

    const proxyAddr = await vpProxy.getAddress();

    // Set routes
    for (const fn of ["initialize", "stakeVdot", "balanceOf", "stakedVdot"]) {
      await vpProxy.setRoute(
        vpStakingImpl.interface.getFunction(fn).selector,
        await vpStakingImpl.getAddress()
      );
    }

    for (const fn of [
      "withdrawWithVP",
      "userNonce",
      "domainSeparator",
      "requestEmergencyWithdraw",
      "emergencyWithdraw",
      "emergencyCooldownRemaining",
      "emergencyDelay",
    ]) {
      await vpProxy.setRoute(
        vpWithdrawImpl.interface.getFunction(fn).selector,
        await vpWithdrawImpl.getAddress()
      );
    }

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
    vpWithdraw = await ethers.getContractAt(
      [
        ...VPStaking.interface.fragments,
        ...VPWithdraw.interface.fragments,
        ...VPAdmin.interface.fragments,
      ],
      proxyAddr
    );

    // Initialize
    await vpWithdraw.initialize(await vdotToken.getAddress(), owner.address);
    await vpWithdraw.setOperator(operator.address, true);

    // Setup user with stake
    await vdotToken.transfer(user1.address, ethers.parseEther("1000"));
    await vdotToken.connect(user1).approve(proxyAddr, ethers.parseEther("100"));
    await vpWithdraw.connect(user1).stakeVdot(ethers.parseEther("100"));
  });

  describe("Normal Withdrawal", function () {
    it("should withdraw with valid signature", async function () {
      const vpBalance = await vpWithdraw.balanceOf(user1.address);
      const vpBurnAmount = vpBalance / 2n;
      const vdotReturn = ethers.parseEther("50");
      const nonce = await vpWithdraw.userNonce(user1.address);
      const proxyAddr = await vpProxy.getAddress();

      const signature = await signWithdrawal(
        operator,
        user1.address,
        vpBurnAmount,
        vdotReturn,
        nonce,
        proxyAddr
      );

      const vdotBefore = await vdotToken.balanceOf(user1.address);

      await expect(
        vpWithdraw
          .connect(user1)
          .withdrawWithVP(vpBurnAmount, vdotReturn, nonce, signature)
      ).to.emit(vpWithdraw, "VdotWithdrawn");

      expect(await vdotToken.balanceOf(user1.address)).to.equal(
        vdotBefore + vdotReturn
      );
      expect(await vpWithdraw.balanceOf(user1.address)).to.equal(
        vpBalance - vpBurnAmount
      );
    });

    it("should reject withdrawal when paused", async function () {
      await vpWithdraw.pause();

      const nonce = await vpWithdraw.userNonce(user1.address);
      const proxyAddr = await vpProxy.getAddress();
      const signature = await signWithdrawal(
        operator,
        user1.address,
        100n,
        ethers.parseEther("1"),
        nonce,
        proxyAddr
      );

      await expect(
        vpWithdraw
          .connect(user1)
          .withdrawWithVP(100n, ethers.parseEther("1"), nonce, signature)
      ).to.be.revertedWith("Pausable: paused");
    });

    it("should reject invalid signature", async function () {
      const nonce = await vpWithdraw.userNonce(user1.address);
      const proxyAddr = await vpProxy.getAddress();

      // Sign with non-operator
      const signature = await signWithdrawal(
        user1,
        user1.address,
        100n,
        ethers.parseEther("1"),
        nonce,
        proxyAddr
      );

      await expect(
        vpWithdraw
          .connect(user1)
          .withdrawWithVP(100n, ethers.parseEther("1"), nonce, signature)
      ).to.be.revertedWith("VP: invalid signature");
    });
  });

  describe("Emergency Withdrawal", function () {
    it("should reject emergency withdraw without request", async function () {
      await expect(
        vpWithdraw.connect(user1).emergencyWithdraw()
      ).to.be.revertedWith("VP: request first");
    });

    it("should reject emergency withdraw before cooldown", async function () {
      await vpWithdraw.connect(user1).requestEmergencyWithdraw();

      await expect(
        vpWithdraw.connect(user1).emergencyWithdraw()
      ).to.be.revertedWith("VP: cooldown not passed");
    });

    it("should allow emergency withdraw after cooldown", async function () {
      await vpWithdraw.connect(user1).requestEmergencyWithdraw();

      // Fast forward 7 days
      await time.increase(SEVEN_DAYS + 1);

      const stakedBefore = await vpWithdraw.stakedVdot(user1.address);
      const vdotBefore = await vdotToken.balanceOf(user1.address);

      await expect(vpWithdraw.connect(user1).emergencyWithdraw())
        .to.emit(vpWithdraw, "EmergencyWithdrawn")
        .withArgs(user1.address, stakedBefore);

      expect(await vdotToken.balanceOf(user1.address)).to.equal(
        vdotBefore + stakedBefore
      );
      expect(await vpWithdraw.stakedVdot(user1.address)).to.equal(0);
      expect(await vpWithdraw.balanceOf(user1.address)).to.equal(0);
    });

    it("should emit EmergencyWithdrawRequested on request", async function () {
      await expect(
        vpWithdraw.connect(user1).requestEmergencyWithdraw()
      ).to.emit(vpWithdraw, "EmergencyWithdrawRequested");
    });

    it("should work even when paused (emergency exit)", async function () {
      await vpWithdraw.connect(user1).requestEmergencyWithdraw();
      await vpWithdraw.pause();

      await time.increase(SEVEN_DAYS + 1);

      // Emergency withdraw should still work
      await expect(vpWithdraw.connect(user1).emergencyWithdraw()).to.emit(
        vpWithdraw,
        "EmergencyWithdrawn"
      );
    });

    it("should report correct cooldown remaining", async function () {
      // Before request
      expect(
        await vpWithdraw.emergencyCooldownRemaining(user1.address)
      ).to.equal(ethers.MaxUint256);

      await vpWithdraw.connect(user1).requestEmergencyWithdraw();

      // Just after request
      const remaining = await vpWithdraw.emergencyCooldownRemaining(
        user1.address
      );
      expect(remaining).to.be.lte(SEVEN_DAYS);
      expect(remaining).to.be.gt(SEVEN_DAYS - 60); // Allow 60s buffer

      // After cooldown
      await time.increase(SEVEN_DAYS + 1);
      expect(
        await vpWithdraw.emergencyCooldownRemaining(user1.address)
      ).to.equal(0);
    });
  });
});
