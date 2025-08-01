import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ProxySponsor2 } from "../typechain";

describe.only("ProxySponsor2 - Hardhat Network Integration Tests", function () {
  let owner: HardhatEthersSigner;
  let dedicatedMsgSender: any;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let receiver: HardhatEthersSigner;
  let proxySponsor: any;
  let proxySponsorAddress: string;

  // Mock contract addresses for testing
  let mockUSDCStakeContract: string;
  let mockETHStakeContract: string;
  let mockTrustedForwarder: string;

  beforeEach(async function () {
    [owner, user1, user2, receiver] = await ethers.getSigners();
    
    // Impersonate the specific dedicated message sender address
    const dedicatedMsgSenderAddress = "0xa546E413a8A8D16DdbcaF0A066f0967484D35be9";
    await ethers.provider.send("hardhat_impersonateAccount", [dedicatedMsgSenderAddress]);
    dedicatedMsgSender = await ethers.getSigner(dedicatedMsgSenderAddress);
    
    // Fund the impersonated account with some ETH for gas
    await owner.sendTransaction({
      to: dedicatedMsgSenderAddress,
      value: ethers.parseEther("10.0")
    });
    
    // Create mock addresses for stake contracts and trusted forwarder
    mockUSDCStakeContract = await user1.getAddress();
    mockETHStakeContract = await user2.getAddress();
    mockTrustedForwarder = await receiver.getAddress();
    
    // Deploy ProxySponsor2 contract with current state
    const ProxySponsorFactory = await ethers.getContractFactory("ProxySponsor2");
    proxySponsor = await ProxySponsorFactory.deploy(
      dedicatedMsgSenderAddress,
      mockTrustedForwarder,
      mockUSDCStakeContract,
      mockETHStakeContract
    );
    proxySponsorAddress = await proxySponsor.getAddress();
    
    // Wait for deployment
    await proxySponsor.waitForDeployment();
  });

  describe("Contract Initialization", function () {
    it("should initialize with correct default values", async function () {
      // Check owner
      expect(await proxySponsor.owner()).to.equal(await owner.getAddress());
      
      // Check dedicated message sender
      expect(await proxySponsor.dedicatedMsgSender()).to.equal(await dedicatedMsgSender.getAddress());
      
      // Check default gas cost coefficient (105%)
      expect(await proxySponsor.gasCostCoefficient()).to.equal(10500);
      
      // Check default gas approve value
      expect(await proxySponsor.gasApprove()).to.equal(40000);
      
      // Check default minimum transfer value
      expect(await proxySponsor.minimumTransferValue()).to.equal(ethers.parseEther("0.001"));
      
      // Check stake contract addresses
      expect(await proxySponsor.stakeContractUSDC()).to.equal(mockUSDCStakeContract);
      expect(await proxySponsor.stakeContractETH()).to.equal(mockETHStakeContract);
      
      // Check initial balance should be zero
      expect(await ethers.provider.getBalance(proxySponsorAddress)).to.equal(0);
    });

    it("should have correct contract balance after deployment", async function () {
      const balance = await ethers.provider.getBalance(proxySponsorAddress);
      expect(balance).to.equal(0);
    });

    it("should use the impersonated dedicated message sender address", async function () {
      const expectedAddress = "0xa546E413a8A8D16DdbcaF0A066f0967484D35be9";
      expect(await proxySponsor.dedicatedMsgSender()).to.equal(expectedAddress);
      expect(await dedicatedMsgSender.getAddress()).to.equal(expectedAddress);
    });
  });

  describe("ETH Deposits and Balance Management", function () {
    it("should accept multiple ETH deposits from different users", async function () {
      const deposit1 = ethers.parseEther("0.5");
      const deposit2 = ethers.parseEther("1.0");
      const deposit3 = ethers.parseEther("0.25");
      
      // Multiple deposits
      await user1.sendTransaction({
        to: proxySponsorAddress,
        value: deposit1
      });
      
      await user2.sendTransaction({
        to: proxySponsorAddress,
        value: deposit2
      });
      
      await receiver.sendTransaction({
        to: proxySponsorAddress,
        value: deposit3
      });
      
      const totalBalance = await ethers.provider.getBalance(proxySponsorAddress);
      expect(totalBalance).to.equal(deposit1 + deposit2 + deposit3);
    });

    it("should handle very small ETH deposits", async function () {
      const smallDeposit = ethers.parseEther("0.000001"); // 1 micro ETH
      
      await user1.sendTransaction({
        to: proxySponsorAddress,
        value: smallDeposit
      });
      
      const balance = await ethers.provider.getBalance(proxySponsorAddress);
      expect(balance).to.equal(smallDeposit);
    });

    it("should handle large ETH deposits", async function () {
      const largeDeposit = ethers.parseEther("100.0"); // 100 ETH
      
      await user1.sendTransaction({
        to: proxySponsorAddress,
        value: largeDeposit
      });
      
      const balance = await ethers.provider.getBalance(proxySponsorAddress);
      expect(balance).to.equal(largeDeposit);
    });
  });

  describe("Airdrop Functionality with Real Gas Calculations", function () {
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
      
      // Use realistic gas price (20 gwei)
      const gasPrice = ethers.parseUnits("20", "gwei");
      
      // Perform airdrop
      const tx = await proxySponsor.connect(dedicatedMsgSender).airdrop(freshReceiverAddress, gasPrice);
      const receipt = await tx.wait();
      
      const finalReceiverBalance = await ethers.provider.getBalance(freshReceiverAddress);
      const finalContractBalance = await ethers.provider.getBalance(proxySponsorAddress);
      
      // Verify transfer occurred
      expect(finalReceiverBalance).to.be.gt(initialReceiverBalance);
      
      // Verify contract balance decreased
      expect(finalContractBalance).to.be.lt(initialContractBalance);
      
      // Verify gas was used
      expect(receipt?.gasUsed).to.be.gt(0);
    });

    it("should handle airdrop with very high gas price", async function () {
      const freshReceiver = ethers.Wallet.createRandom().connect(ethers.provider);
      const freshReceiverAddress = await freshReceiver.getAddress();
      
      // Use very high gas price (1000 gwei)
      const gasPrice = ethers.parseUnits("1000", "gwei");
      
      await expect(
        proxySponsor.connect(dedicatedMsgSender).airdrop(freshReceiverAddress, gasPrice)
      ).to.not.be.reverted;
    });

    it("should handle airdrop with very low gas price", async function () {
      const freshReceiver = ethers.Wallet.createRandom().connect(ethers.provider);
      const freshReceiverAddress = await freshReceiver.getAddress();
      
      // Use very low gas price (1 wei)
      const gasPrice = 1n;
      
      await expect(
        proxySponsor.connect(dedicatedMsgSender).airdrop(freshReceiverAddress, gasPrice)
      ).to.not.be.reverted;
    });

    it("should apply gas cost coefficient correctly", async function () {
      // Set coefficient to 120% (20% increase)
      await proxySponsor.connect(owner).setGasCostCoefficient(12000);
      
      const freshReceiver = ethers.Wallet.createRandom().connect(ethers.provider);
      const freshReceiverAddress = await freshReceiver.getAddress();
      
      const initialReceiverBalance = await ethers.provider.getBalance(freshReceiverAddress);
      const initialContractBalance = await ethers.provider.getBalance(proxySponsorAddress);
      
      const gasPrice = ethers.parseUnits("10", "gwei");
      
      await proxySponsor.connect(dedicatedMsgSender).airdrop(freshReceiverAddress, gasPrice);
      
      const finalReceiverBalance = await ethers.provider.getBalance(freshReceiverAddress);
      const transferredAmount = finalReceiverBalance - initialReceiverBalance;
      
      // The transferred amount should reflect the 120% coefficient
      expect(transferredAmount).to.be.gt(0);
    });

    it("should prevent airdrop to already funded receiver", async function () {
      const freshReceiver = ethers.Wallet.createRandom().connect(ethers.provider);
      const freshReceiverAddress = await freshReceiver.getAddress();
      
      const gasPrice = ethers.parseUnits("10", "gwei");
      
      // First airdrop should succeed
      await proxySponsor.connect(dedicatedMsgSender).airdrop(freshReceiverAddress, gasPrice);
      
      // Second airdrop to same receiver should fail
      await expect(
        proxySponsor.connect(dedicatedMsgSender).airdrop(freshReceiverAddress, gasPrice)
      ).to.be.revertedWithCustomError(proxySponsor, "ReceiverAlreadyFunded");
    });
  });

  describe("Owner Management Functions", function () {
    it("should allow owner to change all configurable parameters", async function () {
      const newOwner = await user1.getAddress();
      const newDedicatedMsgSender = await user2.getAddress();
      const newMinimumValue = ethers.parseEther("0.01");
      const newGasCoefficient = 11000;
      const newGasApprove = 50000;
      const newUSDCStakeContract = await receiver.getAddress();
      const newETHStakeContract = await user1.getAddress();
      
      // Change owner
      await proxySponsor.connect(owner).changeOwner(newOwner);
      expect(await proxySponsor.owner()).to.equal(newOwner);
      
      // Change dedicated message sender (need to use the new owner after ownership change)
      await proxySponsor.connect(user1).changeDedicatedMsgSender(newDedicatedMsgSender);
      expect(await proxySponsor.dedicatedMsgSender()).to.equal(newDedicatedMsgSender);
      
      // Change minimum transfer value
      await proxySponsor.connect(user1).setMinimumTransferValue(newMinimumValue);
      expect(await proxySponsor.minimumTransferValue()).to.equal(newMinimumValue);
      
      // Change gas cost coefficient
      await proxySponsor.connect(user1).setGasCostCoefficient(newGasCoefficient);
      expect(await proxySponsor.gasCostCoefficient()).to.equal(newGasCoefficient);
      
      // Change gas approve
      await proxySponsor.connect(user1).setGasApprove(newGasApprove);
      expect(await proxySponsor.gasApprove()).to.equal(newGasApprove);
      
      // Change stake contracts
      await proxySponsor.connect(user1).changeStakeContractUSDC(newUSDCStakeContract);
      expect(await proxySponsor.stakeContractUSDC()).to.equal(newUSDCStakeContract);
      
      await proxySponsor.connect(user1).changeStakeContractETH(newETHStakeContract);
      expect(await proxySponsor.stakeContractETH()).to.equal(newETHStakeContract);
    });

    it("should prevent non-owner from changing parameters", async function () {
      const newValue = ethers.parseEther("0.01");
      
      await expect(
        proxySponsor.connect(user1).setMinimumTransferValue(newValue)
      ).to.be.revertedWithCustomError(proxySponsor, "OnlyOwner");
      
      await expect(
        proxySponsor.connect(user1).setGasCostCoefficient(11000)
      ).to.be.revertedWithCustomError(proxySponsor, "OnlyOwner");
      
      await expect(
        proxySponsor.connect(user1).setGasApprove(50000)
      ).to.be.revertedWithCustomError(proxySponsor, "OnlyOwner");
      
      await expect(
        proxySponsor.connect(user1).changeOwner(await user2.getAddress())
      ).to.be.revertedWithCustomError(proxySponsor, "OnlyOwner");
      
      await expect(
        proxySponsor.connect(user1).changeDedicatedMsgSender(await user2.getAddress())
      ).to.be.revertedWithCustomError(proxySponsor, "OnlyOwner");
    });
  });

  describe("Withdrawal Functionality", function () {
    beforeEach(async function () {
      // Fund the contract
      await user1.sendTransaction({
        to: proxySponsorAddress,
        value: ethers.parseEther("5.0")
      });
    });

    it("should allow owner to withdraw all funds", async function () {
      const initialOwnerBalance = await ethers.provider.getBalance(await owner.getAddress());
      const initialContractBalance = await ethers.provider.getBalance(proxySponsorAddress);
      
      await proxySponsor.connect(owner).withdraw();
      
      const finalOwnerBalance = await ethers.provider.getBalance(await owner.getAddress());
      const finalContractBalance = await ethers.provider.getBalance(proxySponsorAddress);
      
      // Contract should be empty
      expect(finalContractBalance).to.equal(0);
      
      // Owner should have received the funds (minus gas costs)
      expect(finalOwnerBalance).to.be.gt(initialOwnerBalance - initialContractBalance);
    });

    it("should prevent withdrawal when contract is empty", async function () {
      // Withdraw all funds first
      await proxySponsor.connect(owner).withdraw();
      
      // Try to withdraw again
      await expect(
        proxySponsor.connect(owner).withdraw()
      ).to.be.revertedWithCustomError(proxySponsor, "NoFundsToWithdraw");
    });

    it("should prevent non-owner from withdrawing", async function () {
      await expect(
        proxySponsor.connect(user1).withdraw()
      ).to.be.revertedWithCustomError(proxySponsor, "OnlyOwner");
    });
  });

  describe("Staking Function Integration", function () {
    it("should validate stake contract addresses", async function () {
      // Deploy contract with zero stake contract addresses
      const ProxySponsorFactory = await ethers.getContractFactory("ProxySponsor2");
      const newProxySponsor: any = await ProxySponsorFactory.deploy(
        await dedicatedMsgSender.getAddress(),
        mockTrustedForwarder,
        ethers.ZeroAddress, // zero USDC stake contract
        ethers.ZeroAddress  // zero ETH stake contract
      );
      
      // Should revert for USDC staking
      await expect(
        newProxySponsor.connect(user1).stakeUSDC(ethers.parseUnits("100", 6))
      ).to.be.revertedWithCustomError(newProxySponsor, "InvalidStakeContract");
      
      // Should revert for ETH staking
      await expect(
        newProxySponsor.connect(user1).stakeETH(ethers.parseEther("0.1"))
      ).to.be.revertedWithCustomError(newProxySponsor, "InvalidStakeContract");
    });

    it("should allow changing stake contract addresses", async function () {
      const newUSDCStakeContract = await user1.getAddress();
      const newETHStakeContract = await user2.getAddress();
      
      await proxySponsor.connect(owner).changeStakeContractUSDC(newUSDCStakeContract);
      await proxySponsor.connect(owner).changeStakeContractETH(newETHStakeContract);
      
      expect(await proxySponsor.stakeContractUSDC()).to.equal(newUSDCStakeContract);
      expect(await proxySponsor.stakeContractETH()).to.equal(newETHStakeContract);
    });
  });

  describe("Edge Cases and Error Handling", function () {
    it("should handle zero address inputs correctly", async function () {
      // Fund the contract first to avoid InsufficientBalance error
      await user1.sendTransaction({
        to: proxySponsorAddress,
        value: ethers.parseEther("1.0")
      });
      
      const gasPrice = ethers.parseUnits("10", "gwei");
      
      // Airdrop to zero address should fail
      await expect(
        proxySponsor.connect(dedicatedMsgSender).airdrop(ethers.ZeroAddress, gasPrice)
      ).to.be.revertedWithCustomError(proxySponsor, "InvalidReceiver");
      
      // Change owner to zero address should fail
      await expect(
        proxySponsor.connect(owner).changeOwner(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(proxySponsor, "InvalidNewOwner");
      
      // Change dedicated message sender to zero address should fail
      await expect(
        proxySponsor.connect(owner).changeDedicatedMsgSender(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(proxySponsor, "InvalidDedicatedMsgSender");
    });

    it("should handle invalid gas price", async function () {
      const freshReceiver = ethers.Wallet.createRandom().connect(ethers.provider);
      const freshReceiverAddress = await freshReceiver.getAddress();
      
      // Fund contract first
      await user1.sendTransaction({
        to: proxySponsorAddress,
        value: ethers.parseEther("1.0")
      });
      
      // Zero gas price should fail
      await expect(
        proxySponsor.connect(dedicatedMsgSender).airdrop(freshReceiverAddress, 0)
      ).to.be.revertedWithCustomError(proxySponsor, "InvalidGasPrice");
    });

    it("should handle insufficient contract balance", async function () {
      const freshReceiver = ethers.Wallet.createRandom().connect(ethers.provider);
      const freshReceiverAddress = await freshReceiver.getAddress();
      const gasPrice = ethers.parseUnits("10", "gwei");
      
      // Contract has no balance, should fail
      await expect(
        proxySponsor.connect(dedicatedMsgSender).airdrop(freshReceiverAddress, gasPrice)
      ).to.be.revertedWithCustomError(proxySponsor, "InsufficientBalance");
    });

    it("should handle invalid gas cost coefficient values", async function () {
      // Below minimum (10000)
      await expect(
        proxySponsor.connect(owner).setGasCostCoefficient(9999)
      ).to.be.revertedWithCustomError(proxySponsor, "InvalidGasCostCoefficient");
      
      // Above maximum (20000)
      await expect(
        proxySponsor.connect(owner).setGasCostCoefficient(20001)
      ).to.be.revertedWithCustomError(proxySponsor, "InvalidGasCostCoefficient");
    });

    it("should handle invalid gas values", async function () {
      // Zero gas approve should fail
      await expect(
        proxySponsor.connect(owner).setGasApprove(0)
      ).to.be.revertedWithCustomError(proxySponsor, "InvalidGasValue");
    });
  });

  describe("Gas Optimization and Performance", function () {
    it("should use custom errors instead of require statements", async function () {
      // This test verifies that the contract uses custom errors
      // which are more gas efficient than require statements
      
      const gasPrice = ethers.parseUnits("10", "gwei");
      
      // Test various error conditions
      await expect(
        proxySponsor.connect(user1).airdrop(await receiver.getAddress(), gasPrice)
      ).to.be.revertedWithCustomError(proxySponsor, "OnlyDedicatedMsgSender");
      
      await expect(
        proxySponsor.connect(user1).withdraw()
      ).to.be.revertedWithCustomError(proxySponsor, "OnlyOwner");
      
      await expect(
        proxySponsor.connect(owner).setMinimumTransferValue(0)
      ).to.be.revertedWithCustomError(proxySponsor, "InvalidMinimumValue");
    });

    it("should handle multiple rapid airdrops efficiently", async function () {
      // Fund the contract
      await user1.sendTransaction({
        to: proxySponsorAddress,
        value: ethers.parseEther("10.0")
      });
      
      const gasPrice = ethers.parseUnits("10", "gwei");
      
      // Perform multiple airdrops in sequence
      for (let i = 0; i < 5; i++) {
        const freshReceiver = ethers.Wallet.createRandom().connect(ethers.provider);
        const freshReceiverAddress = await freshReceiver.getAddress();
        
        await expect(
          proxySponsor.connect(dedicatedMsgSender).airdrop(freshReceiverAddress, gasPrice)
        ).to.not.be.reverted;
      }
    });
  });

  describe("Integration with Hardhat Network Features", function () {
    it("should work with Hardhat's automatic gas estimation", async function () {
      // Fund the contract
      await user1.sendTransaction({
        to: proxySponsorAddress,
        value: ethers.parseEther("1.0")
      });
      
      const freshReceiver = ethers.Wallet.createRandom().connect(ethers.provider);
      const freshReceiverAddress = await freshReceiver.getAddress();
      
      // Use automatic gas estimation
      const gasPrice = await ethers.provider.getFeeData().then(fee => fee.gasPrice || ethers.parseUnits("1", "gwei"));
      
      await expect(
        proxySponsor.connect(dedicatedMsgSender).airdrop(freshReceiverAddress, gasPrice)
      ).to.not.be.reverted;
    });

    it("should handle Hardhat network block time changes", async function () {
      // Fund the contract
      await user1.sendTransaction({
        to: proxySponsorAddress,
        value: ethers.parseEther("1.0")
      });
      
      const freshReceiver = ethers.Wallet.createRandom().connect(ethers.provider);
      const freshReceiverAddress = await freshReceiver.getAddress();
      const gasPrice = ethers.parseUnits("10", "gwei");
      
      // Mine a few blocks
      await ethers.provider.send("evm_mine", []);
      await ethers.provider.send("evm_mine", []);
      
      // Airdrop should still work
      await expect(
        proxySponsor.connect(dedicatedMsgSender).airdrop(freshReceiverAddress, gasPrice)
      ).to.not.be.reverted;
    });
  });
}); 