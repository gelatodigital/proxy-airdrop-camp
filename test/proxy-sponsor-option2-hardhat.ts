import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe.only("ProxySponsor2 - Airdrop Test", function () {
  let owner: HardhatEthersSigner;
  let dedicatedMsgSender: any;
  let user1: HardhatEthersSigner;
  let proxySponsor: any;
  let proxySponsorAddress: string;

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();
    
    // Impersonate the specific dedicated message sender address
    const dedicatedMsgSenderAddress = "0xa546E413a8A8D16DdbcaF0A066f0967484D35be9";
    await ethers.provider.send("hardhat_impersonateAccount", [dedicatedMsgSenderAddress]);
    dedicatedMsgSender = await ethers.getSigner(dedicatedMsgSenderAddress);
    
    // Fund the impersonated account with some ETH for gas
    await owner.sendTransaction({
      to: dedicatedMsgSenderAddress,
      value: ethers.parseEther("10.0")
    });
    
    // Read existing ProxySponsor2 contract at the specified address
    const existingContractAddress = "0x4138554D094A2C8Db81e89f3f1886c1E3e906748";
    proxySponsorAddress = existingContractAddress;
    
    // Get the contract instance
    const ProxySponsorFactory = await ethers.getContractFactory("ProxySponsor2");
    proxySponsor = ProxySponsorFactory.attach(existingContractAddress);
    
    // Verify the contract exists and is accessible
    const code = await ethers.provider.getCode(existingContractAddress);
    if (code === "0x") {
      throw new Error(`No contract found at address ${existingContractAddress}`);
    }
  });

  describe("Airdrop Functionality", function () {
    beforeEach(async function () {
      // Fund the contract with sufficient ETH
      await user1.sendTransaction({
        to: proxySponsorAddress,
        value: ethers.parseEther("10.0")
      });
    });

    it("should perform airdrop with realistic gas price", async function () {
      // Create a fresh receiver with zero balance
      const freshReceiver = ethers.Wallet.createRandom().connect(ethers.provider);
      const freshReceiverAddress = await freshReceiver.getAddress();
      
      const initialReceiverBalance = await ethers.provider.getBalance(freshReceiverAddress);
      const initialContractBalance = await ethers.provider.getBalance(proxySponsorAddress);
      
      // Log contract balance before airdrop
      console.log(`Contract balance before airdrop: ${ethers.formatEther(initialContractBalance)} ETH`);
      console.log(`Receiver address: ${freshReceiverAddress}`);
      console.log(`Receiver balance before airdrop: ${ethers.formatEther(initialReceiverBalance)} ETH`);
      
      // Use realistic gas price (20 gwei)
      const gasPrice = 1500000006 //ethers.parseUnits("20", "gwei");
      
      // Perform airdrop
      const tx = await proxySponsor.connect(dedicatedMsgSender).airdrop(freshReceiverAddress, gasPrice);
      const receipt = await tx.wait();
      
      const finalReceiverBalance = await ethers.provider.getBalance(freshReceiverAddress);
      const finalContractBalance = await ethers.provider.getBalance(proxySponsorAddress);
      
      // Log balances after airdrop
      console.log(`Contract balance after airdrop: ${ethers.formatEther(finalContractBalance)} ETH`);
      console.log(`Receiver balance after airdrop: ${ethers.formatEther(finalReceiverBalance)} ETH`);
      console.log(`Amount transferred: ${ethers.formatEther(finalReceiverBalance - initialReceiverBalance)} ETH`);
      console.log(`Contract balance change: ${ethers.formatEther(initialContractBalance - finalContractBalance)} ETH`);
      
      // Verify transfer occurred
      expect(finalReceiverBalance).to.be.gt(initialReceiverBalance);
      
      // Verify contract balance decreased
      expect(finalContractBalance).to.be.lt(initialContractBalance);
      
      // Verify gas was used
      expect(receipt?.gasUsed).to.be.gt(0);
    });
  });
}); 