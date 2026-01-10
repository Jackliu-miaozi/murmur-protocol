// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const StorageModule = buildModule("StorageModule", (m) => {
    // Example: Deploy a simple storage contract
    // Replace "Storage" with your actual contract name
    const storage = m.contract("Storage");

    return { storage };
});

module.exports = StorageModule;
