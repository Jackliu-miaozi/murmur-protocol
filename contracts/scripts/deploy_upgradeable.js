const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // 1. Deploy VDOTToken (Standard, not upgradeable for this example)
  console.log("Deploying VDOTToken...");
  const VDOTToken = await ethers.getContractFactory("VDOTToken");
  const vdotToken = await VDOTToken.deploy(deployer.address);
  await vdotToken.waitForDeployment();
  const vdotTokenAddress = await vdotToken.getAddress();
  console.log("VDOTToken deployed to:", vdotTokenAddress);

  // 2. Deploy VPToken (UUPS Upgradeable)
  console.log("Deploying VPToken (UUPS)...");
  const VPToken = await ethers.getContractFactory("VPToken");
  const vpToken = await upgrades.deployProxy(
    VPToken,
    [vdotTokenAddress, deployer.address],
    { kind: "uups" }
  );
  await vpToken.waitForDeployment();
  const vpTokenAddress = await vpToken.getAddress();
  console.log("VPToken Proxy deployed to:", vpTokenAddress);

  // 3. Deploy MurmurNFT (UUPS Upgradeable)
  console.log("Deploying MurmurNFT (UUPS)...");
  const MurmurNFT = await ethers.getContractFactory("MurmurNFT");
  const murmurNFT = await upgrades.deployProxy(
    MurmurNFT,
    [vpTokenAddress, deployer.address],
    { kind: "uups" }
  );
  await murmurNFT.waitForDeployment();
  const murmurNFTAddress = await murmurNFT.getAddress();
  console.log("MurmurNFT Proxy deployed to:", murmurNFTAddress);

  // 4. Deploy MurmurProtocol (UUPS Upgradeable)
  console.log("Deploying MurmurProtocol (UUPS)...");
  const MurmurProtocol = await ethers.getContractFactory("MurmurProtocol");
  const murmurProtocol = await upgrades.deployProxy(
    MurmurProtocol,
    [vdotTokenAddress, vpTokenAddress, murmurNFTAddress],
    { kind: "uups" }
  );
  await murmurProtocol.waitForDeployment();
  const murmurProtocolAddress = await murmurProtocol.getAddress();
  console.log("MurmurProtocol Proxy deployed to:", murmurProtocolAddress);

  console.log("\n=== Deployment Summary ===");
  console.log("VDOTToken:      ", vdotTokenAddress);
  console.log("VPToken:        ", vpTokenAddress);
  console.log("MurmurNFT:      ", murmurNFTAddress);
  console.log("MurmurProtocol: ", murmurProtocolAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
