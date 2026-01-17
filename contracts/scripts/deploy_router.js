const hre = require("hardhat");

// Helper to get function selectors from a contract
function getSelectors(contract) {
  const signatures = Object.keys(contract.interface.functions);
  const selectors = signatures.reduce((acc, signature) => {
    if (signature !== "init(bytes)") {
      acc.push(contract.interface.getSighash(signature));
    }
    return acc;
  }, []);
  return selectors;
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(
    "Deploying Router Proxy contracts with account:",
    deployer.address
  );

  // ============ Phase 1: Deploy VDOTToken ============
  console.log("\n=== Phase 1: Deploy VDOTToken ===\n");

  const VDOTToken = await hre.ethers.getContractFactory("VDOTToken");
  const vdotToken = await VDOTToken.deploy(deployer.address);
  await vdotToken.waitForDeployment();
  const vdotTokenAddress = await vdotToken.getAddress();
  console.log("1. VDOTToken deployed to:", vdotTokenAddress);

  // ============ Phase 2: Deploy VP Token Facets ============
  console.log("\n=== Phase 2: Deploy VP Token Facets ===\n");

  const VPStaking = await hre.ethers.getContractFactory("VPStaking");
  const vpStakingFacet = await VPStaking.deploy();
  await vpStakingFacet.waitForDeployment();
  console.log(
    "   - VPStaking deployed:",
    await vpStakingFacet.getAddress()
  );

  const VPWithdraw = await hre.ethers.getContractFactory(
    "VPWithdraw"
  );
  const vpWithdrawFacet = await VPWithdraw.deploy();
  await vpWithdrawFacet.waitForDeployment();
  console.log(
    "   - VPWithdraw deployed:",
    await vpWithdrawFacet.getAddress()
  );

  const VPSettlement = await hre.ethers.getContractFactory(
    "VPSettlement"
  );
  const vpSettlementFacet = await VPSettlement.deploy();
  await vpSettlementFacet.waitForDeployment();
  console.log(
    "   - VPSettlement deployed:",
    await vpSettlementFacet.getAddress()
  );

  const VPAdmin = await hre.ethers.getContractFactory("VPAdmin");
  const vpAdminFacet = await VPAdmin.deploy();
  await vpAdminFacet.waitForDeployment();
  console.log("   - VPAdmin deployed:", await vpAdminFacet.getAddress());

  // ============ Phase 3: Deploy VP Router Proxy ============
  console.log("\n=== Phase 3: Deploy VP Router Proxy ===\n");

  const RouterProxy = await hre.ethers.getContractFactory("RouterProxy");
  const vpProxy = await RouterProxy.deploy(deployer.address);
  await vpProxy.waitForDeployment();
  const vpProxyAddress = await vpProxy.getAddress();
  console.log("2. VP RouterProxy deployed to:", vpProxyAddress);

  // Set routes for VP facets
  let tx = await vpProxy.setRoutes(
    getSelectors(vpStakingFacet),
    await vpStakingFacet.getAddress()
  );
  await tx.wait();
  tx = await vpProxy.setRoutes(
    getSelectors(vpWithdrawFacet),
    await vpWithdrawFacet.getAddress()
  );
  await tx.wait();
  tx = await vpProxy.setRoutes(
    getSelectors(vpSettlementFacet),
    await vpSettlementFacet.getAddress()
  );
  await tx.wait();
  tx = await vpProxy.setRoutes(
    getSelectors(vpAdminFacet),
    await vpAdminFacet.getAddress()
  );
  await tx.wait();
  console.log("   ✅ VP routes configured");

  // Initialize VP Token
  const vpInit = await hre.ethers.getContractAt(
    "VPStaking",
    vpProxyAddress
  );
  tx = await vpInit.initialize(vdotTokenAddress, deployer.address);
  await tx.wait();
  console.log("   ✅ VP Token initialized");

  // ============ Phase 4: Deploy NFT Facets ============
  console.log("\n=== Phase 4: Deploy NFT Facets ===\n");

  const NFTMint = await hre.ethers.getContractFactory("NFTMint");
  const nftMintFacet = await NFTMint.deploy();
  await nftMintFacet.waitForDeployment();
  console.log("   - NFTMint deployed:", await nftMintFacet.getAddress());

  const NFTQuery = await hre.ethers.getContractFactory("NFTQuery");
  const nftQueryFacet = await NFTQuery.deploy();
  await nftQueryFacet.waitForDeployment();
  console.log("   - NFTQuery deployed:", await nftQueryFacet.getAddress());

  const NFTAdmin = await hre.ethers.getContractFactory("NFTAdmin");
  const nftAdminFacet = await NFTAdmin.deploy();
  await nftAdminFacet.waitForDeployment();
  console.log("   - NFTAdmin deployed:", await nftAdminFacet.getAddress());

  // ============ Phase 5: Deploy NFT Router Proxy ============
  console.log("\n=== Phase 5: Deploy NFT Router Proxy ===\n");

  const nftProxy = await RouterProxy.deploy(deployer.address);
  await nftProxy.waitForDeployment();
  const nftProxyAddress = await nftProxy.getAddress();
  console.log("3. NFT RouterProxy deployed to:", nftProxyAddress);

  // Set routes for NFT facets
  tx = await nftProxy.setRoutes(
    getSelectors(nftMintFacet),
    await nftMintFacet.getAddress()
  );
  await tx.wait();
  tx = await nftProxy.setRoutes(
    getSelectors(nftQueryFacet),
    await nftQueryFacet.getAddress()
  );
  await tx.wait();
  tx = await nftProxy.setRoutes(
    getSelectors(nftAdminFacet),
    await nftAdminFacet.getAddress()
  );
  await tx.wait();
  console.log("   ✅ NFT routes configured");

  // Initialize NFT
  const nftInit = await hre.ethers.getContractAt(
    "NFTMint",
    nftProxyAddress
  );
  tx = await nftInit.initialize(deployer.address);
  await tx.wait();
  console.log("   ✅ NFT initialized");

  // ============ Phase 6: Deploy Protocol Registry ============
  console.log("\n=== Phase 6: Deploy Protocol Registry ===\n");

  const MurmurProtocol = await hre.ethers.getContractFactory("MurmurProtocol");
  const murmurProtocol = await MurmurProtocol.deploy(
    vpProxyAddress,
    nftProxyAddress,
    vdotTokenAddress
  );
  await murmurProtocol.waitForDeployment();
  const murmurProtocolAddress = await murmurProtocol.getAddress();
  console.log("4. MurmurProtocol deployed to:", murmurProtocolAddress);

  // ============ Summary ============
  console.log("\n" + "=".repeat(60));
  console.log("🎉 Router Proxy Deployment Complete!");
  console.log("=".repeat(60));
  console.log("\n📝 Contract Addresses:");
  console.log("─".repeat(60));
  console.log("MurmurProtocol:     ", murmurProtocolAddress);
  console.log("VDOTToken:          ", vdotTokenAddress);
  console.log("─".repeat(60));
  console.log("VP Proxy:           ", vpProxyAddress);
  console.log("  - VPStaking: ", await vpStakingFacet.getAddress());
  console.log("  - VPWithdraw:", await vpWithdrawFacet.getAddress());
  console.log("  - VPSettlement:", await vpSettlementFacet.getAddress());
  console.log("  - VPAdmin:   ", await vpAdminFacet.getAddress());
  console.log("─".repeat(60));
  console.log("NFT Proxy:          ", nftProxyAddress);
  console.log("  - NFTMint:   ", await nftMintFacet.getAddress());
  console.log("  - NFTQuery:  ", await nftQueryFacet.getAddress());
  console.log("  - NFTAdmin:  ", await nftAdminFacet.getAddress());
  console.log("─".repeat(60));
  console.log("\n✅ All contracts deployed successfully!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
