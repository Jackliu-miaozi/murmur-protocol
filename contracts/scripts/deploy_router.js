const hre = require("hardhat");

// Helper to get function selectors from a contract (ethers.js v6)
function getSelectors(contract) {
  const selectors = [];
  for (const fragment of contract.interface.fragments) {
    if (fragment.type === "function") {
      // Use fragment.selector directly to handle overloaded functions
      selectors.push(fragment.selector);
    }
  }
  return selectors;
}

// Helper to sleep
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to set routes one by one (for PolkaVM compatibility)
async function setRoutesOneByOne(proxy, contract, gasLimit = 10000000) {
  const selectors = getSelectors(contract);
  const implAddress = await contract.getAddress();
  for (const selector of selectors) {
    let retries = 3;
    while (retries > 0) {
      try {
        const tx = await proxy.setRoute(selector, implAddress, {
          gasLimit,
          type: 0, // Legacy transaction
        });
        await tx.wait();
        await delay(2000); // 2s delay
        break; // Success
      } catch (error) {
        console.error(
          `Failed to set route for selector ${selector}:`,
          error.message
        );
        retries--;
        if (retries === 0) throw error;
        console.log(`Retrying... (${retries} attempts left)`);
        await delay(5000); // 5s wait
      }
    }
  }
  console.log(
    `     Set ${selectors.length} routes for ${implAddress.slice(0, 10)}...`
  );
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(
    "Deploying Router Proxy contracts with account:",
    deployer.address
  );

  const gasLimit = 1000000; // Explicit gas limit for PolkaVM

  // ============ Phase 1: Deploy VDOTToken ============
  console.log("\n=== Phase 1: Deploy VDOTToken ===\n");

  const VDOTToken = await hre.ethers.getContractFactory("VDOTToken");
  const vdotToken = await VDOTToken.deploy(deployer.address, {
    gasLimit: 5000000,
  });
  await vdotToken.waitForDeployment();
  const vdotTokenAddress = await vdotToken.getAddress();
  console.log("1. VDOTToken deployed to:", vdotTokenAddress);

  // ============ Phase 2: Deploy VP Token Facets ============
  console.log("\n=== Phase 2: Deploy VP Token Facets ===\n");

  const VPStaking = await hre.ethers.getContractFactory("VPStaking");
  const vpStakingFacet = await VPStaking.deploy({ gasLimit: 5000000 });
  await vpStakingFacet.waitForDeployment();
  console.log("   - VPStaking deployed:", await vpStakingFacet.getAddress());

  const VPWithdraw = await hre.ethers.getContractFactory("VPWithdraw");
  const vpWithdrawFacet = await VPWithdraw.deploy({ gasLimit: 10000000 });
  await vpWithdrawFacet.waitForDeployment();
  console.log("   - VPWithdraw deployed:", await vpWithdrawFacet.getAddress());

  const VPSettlement = await hre.ethers.getContractFactory("VPSettlement");
  const vpSettlementFacet = await VPSettlement.deploy({ gasLimit: 8000000 });
  await vpSettlementFacet.waitForDeployment();
  console.log(
    "   - VPSettlement deployed:",
    await vpSettlementFacet.getAddress()
  );

  const VPAdmin = await hre.ethers.getContractFactory("VPAdmin");
  const vpAdminFacet = await VPAdmin.deploy({ gasLimit: 5000000 });
  await vpAdminFacet.waitForDeployment();
  console.log("   - VPAdmin deployed:", await vpAdminFacet.getAddress());

  // ============ Phase 3: Deploy VP Router Proxy ============
  console.log("\n=== Phase 3: Deploy VP Router Proxy ===\n");

  const RouterProxy = await hre.ethers.getContractFactory("RouterProxy");
  const vpProxy = await RouterProxy.deploy(deployer.address, {
    gasLimit: 5000000,
  });
  await vpProxy.waitForDeployment();
  const vpProxyAddress = await vpProxy.getAddress();
  console.log("2. VP RouterProxy deployed to:", vpProxyAddress);

  // Set routes for VP facets (one by one for PolkaVM)
  console.log("   Setting VP routes one by one...");
  await setRoutesOneByOne(vpProxy, vpStakingFacet, gasLimit);
  await setRoutesOneByOne(vpProxy, vpWithdrawFacet, gasLimit);
  await setRoutesOneByOne(vpProxy, vpSettlementFacet, gasLimit);
  await setRoutesOneByOne(vpProxy, vpAdminFacet, gasLimit);
  console.log("   ✅ VP routes configured");

  // Initialize VP Token
  const vpInit = await hre.ethers.getContractAt("VPStaking", vpProxyAddress);
  let tx = await vpInit.initialize(vdotTokenAddress, deployer.address, {
    gasLimit,
  });
  await tx.wait();
  console.log("   ✅ VP Token initialized");

  // ============ Phase 4: Deploy NFT Facets ============
  console.log("\n=== Phase 4: Deploy NFT Facets ===\n");

  const NFTMint = await hre.ethers.getContractFactory("NFTMint");
  const nftMintFacet = await NFTMint.deploy({ gasLimit: 8000000 });
  await nftMintFacet.waitForDeployment();
  console.log("   - NFTMint deployed:", await nftMintFacet.getAddress());

  const NFTQuery = await hre.ethers.getContractFactory("NFTQuery");
  const nftQueryFacet = await NFTQuery.deploy({ gasLimit: 10000000 });
  await nftQueryFacet.waitForDeployment();
  console.log("   - NFTQuery deployed:", await nftQueryFacet.getAddress());

  const NFTAdmin = await hre.ethers.getContractFactory("NFTAdmin");
  const nftAdminFacet = await NFTAdmin.deploy({ gasLimit: 5000000 });
  await nftAdminFacet.waitForDeployment();
  console.log("   - NFTAdmin deployed:", await nftAdminFacet.getAddress());

  const NFTApproval = await hre.ethers.getContractFactory("NFTApproval");
  const nftApprovalFacet = await NFTApproval.deploy({ gasLimit: 5000000 });
  await nftApprovalFacet.waitForDeployment();
  console.log(
    "   - NFTApproval deployed:",
    await nftApprovalFacet.getAddress()
  );

  // ============ Phase 5: Deploy NFT Router Proxy ============
  console.log("\n=== Phase 5: Deploy NFT Router Proxy ===\n");

  const nftProxy = await RouterProxy.deploy(deployer.address, {
    gasLimit: 5000000,
  });
  await nftProxy.waitForDeployment();
  const nftProxyAddress = await nftProxy.getAddress();
  console.log("3. NFT RouterProxy deployed to:", nftProxyAddress);

  // Set routes for NFT facets (one by one for PolkaVM)
  console.log("   Setting NFT routes one by one...");
  await setRoutesOneByOne(nftProxy, nftMintFacet, gasLimit);
  await setRoutesOneByOne(nftProxy, nftQueryFacet, gasLimit);
  await setRoutesOneByOne(nftProxy, nftAdminFacet, gasLimit);
  await setRoutesOneByOne(nftProxy, nftApprovalFacet, gasLimit);
  console.log("   ✅ NFT routes configured");

  // Initialize NFT
  const nftInit = await hre.ethers.getContractAt("NFTMint", nftProxyAddress);
  tx = await nftInit.initialize(deployer.address, { gasLimit });
  await tx.wait();
  console.log("   ✅ NFT initialized");

  // ============ Phase 6: Deploy Protocol Registry ============
  console.log("\n=== Phase 6: Deploy Protocol Registry ===\n");

  const MurmurProtocol = await hre.ethers.getContractFactory("MurmurProtocol");
  const murmurProtocol = await MurmurProtocol.deploy(
    vpProxyAddress,
    nftProxyAddress,
    vdotTokenAddress,
    { gasLimit: 3000000 }
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
  console.log("  - VPStaking:    ", await vpStakingFacet.getAddress());
  console.log("  - VPWithdraw:   ", await vpWithdrawFacet.getAddress());
  console.log("  - VPSettlement: ", await vpSettlementFacet.getAddress());
  console.log("  - VPAdmin:      ", await vpAdminFacet.getAddress());
  console.log("─".repeat(60));
  console.log("NFT Proxy:          ", nftProxyAddress);
  console.log("  - NFTMint:     ", await nftMintFacet.getAddress());
  console.log("  - NFTQuery:    ", await nftQueryFacet.getAddress());
  console.log("  - NFTAdmin:    ", await nftAdminFacet.getAddress());
  console.log("  - NFTApproval: ", await nftApprovalFacet.getAddress());
  console.log("─".repeat(60));
  console.log("\n✅ All contracts deployed successfully!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
