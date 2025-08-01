import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ProxySponsor2 } from "../typechain";

describe("ProxySponsor2 (Full Featured)", function () {
  let owner: HardhatEthersSigner;
  let dedicatedMsgSender: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let receiver: HardhatEthersSigner;
  let proxySponsor: ProxySponsor2;
  let proxySponsorAddress: string;

  beforeEach(async function () {
    [owner, dedicatedMsgSender, user, receiver] = await ethers.getSigners();
    
    // Mock addresses for stake contracts
    const mockStakeContractUSDC = await user.getAddress(); // Using as mock USDC stake contract address
    const mockStakeContractETH = await receiver.getAddress(); // Using as mock ETH stake contract address
    
    // Deploy ProxySponsor2 contract
    const ProxySponsorFactory = await ethers.getContractFactory("ProxySponsor2");
    proxySponsor = await ProxySponsorFactory.deploy(
      await dedicatedMsgSender.getAddress(),
      await owner.getAddress(), // trusted forwarder
      mockStakeContractUSDC,
      mockStakeContractETH
    );
    proxySponsorAddress = await proxySponsor.getAddress();
  });

  describe("Constructor", function () {
    it("should set the correct owner and dedicated message sender", async function () {
      expect(await proxySponsor.owner()).to.equal(await owner.getAddress());
      expect(await proxySponsor.dedicatedMsgSender()).to.equal(await dedicatedMsgSender.getAddress());
    });
  });

  describe("receive()", function () {
    it("should accept ETH deposits", async function () {
      const depositAmount = ethers.parseEther("1.0");
      const initialBalance = await ethers.provider.getBalance(proxySponsorAddress);
      
      await user.sendTransaction({
        to: proxySponsorAddress,
        value: depositAmount
      });
      
      const finalBalance = await ethers.provider.getBalance(proxySponsorAddress);
      expect(finalBalance).to.equal(initialBalance + depositAmount);
    });
  });

  describe("airdrop()", function () {
    beforeEach(async function () {
      // Fund the contract first
      await user.sendTransaction({
        to: proxySponsorAddress,
        value: ethers.parseEther("1.0")
      });
    });

    it("should allow dedicated message sender to airdrop ETH", async function () {
      // Create a fresh receiver with zero balance
      const freshReceiver = ethers.Wallet.createRandom().connect(ethers.provider);
      const freshReceiverAddress = await freshReceiver.getAddress();
      
      const initialReceiverBalance = await ethers.provider.getBalance(freshReceiverAddress);
      expect(initialReceiverBalance).to.equal(0);
      
      // Send airdrop with 5 gwei gas price
      const gasPrice = ethers.parseUnits("5", "gwei");
      await proxySponsor.connect(dedicatedMsgSender).airdrop(freshReceiverAddress, gasPrice);
      
      const finalReceiverBalance = await ethers.provider.getBalance(freshReceiverAddress);
      expect(finalReceiverBalance).to.be.gt(initialReceiverBalance);
    });

    it("should revert if called by non-dedicated message sender", async function () {
      const receiverAddress = await receiver.getAddress();
      const gasPrice = ethers.parseUnits("5", "gwei");
      
      await expect(
        proxySponsor.connect(user).airdrop(receiverAddress, gasPrice)
      ).to.be.revertedWithCustomError(proxySponsor, "OnlyDedicatedMsgSender");
    });

    it("should revert if contract has no balance", async function () {
      // Withdraw all funds first
      await proxySponsor.connect(owner).withdraw();
      
      const receiverAddress = await receiver.getAddress();
      const gasPrice = ethers.parseUnits("5", "gwei");
      
      await expect(
        proxySponsor.connect(dedicatedMsgSender).airdrop(receiverAddress, gasPrice)
      ).to.be.revertedWithCustomError(proxySponsor, "InsufficientBalance");
    });

    it("should revert if receiver is zero address", async function () {
      const gasPrice = ethers.parseUnits("5", "gwei");
      await expect(
        proxySponsor.connect(dedicatedMsgSender).airdrop(ethers.ZeroAddress, gasPrice)
      ).to.be.revertedWithCustomError(proxySponsor, "InvalidReceiver");
    });

    it("should revert if gas price is zero", async function () {
      const receiverAddress = await receiver.getAddress();
      await expect(
        proxySponsor.connect(dedicatedMsgSender).airdrop(receiverAddress, 0)
      ).to.be.revertedWithCustomError(proxySponsor, "InvalidGasPrice");
    });
  });

  describe("setMinimumTransferValue()", function () {
    it("should allow owner to set minimum transfer value", async function () {
      const newMinimum = ethers.parseEther("0.01");
      await proxySponsor.connect(owner).setMinimumTransferValue(newMinimum);
      expect(await proxySponsor.minimumTransferValue()).to.equal(newMinimum);
    });

    it("should revert if called by non-owner", async function () {
      const newMinimum = ethers.parseEther("0.01");
      await expect(
        proxySponsor.connect(user).setMinimumTransferValue(newMinimum)
      ).to.be.revertedWithCustomError(proxySponsor, "OnlyOwner");
    });

    it("should revert if minimum value is zero", async function () {
      await expect(
        proxySponsor.connect(owner).setMinimumTransferValue(0)
      ).to.be.revertedWithCustomError(proxySponsor, "InvalidMinimumValue");
    });
  });

  describe("setGasCostCoefficient()", function () {
    it("should allow owner to set gas cost coefficient", async function () {
      const newCoefficient = 11000; // 110%
      await proxySponsor.connect(owner).setGasCostCoefficient(newCoefficient);
      expect(await proxySponsor.gasCostCoefficient()).to.equal(newCoefficient);
    });

    it("should revert if called by non-owner", async function () {
      const newCoefficient = 11000; // 110%
      await expect(
        proxySponsor.connect(user).setGasCostCoefficient(newCoefficient)
      ).to.be.revertedWithCustomError(proxySponsor, "OnlyOwner");
    });

    it("should revert if coefficient is below 10000", async function () {
      await expect(
        proxySponsor.connect(owner).setGasCostCoefficient(9999)
      ).to.be.revertedWithCustomError(proxySponsor, "InvalidGasCostCoefficient");
    });

    it("should revert if coefficient is above 20000", async function () {
      await expect(
        proxySponsor.connect(owner).setGasCostCoefficient(20001)
      ).to.be.revertedWithCustomError(proxySponsor, "InvalidGasCostCoefficient");
    });

    it("should allow coefficient at minimum value (10000)", async function () {
      await proxySponsor.connect(owner).setGasCostCoefficient(10000);
      expect(await proxySponsor.gasCostCoefficient()).to.equal(10000);
    });

    it("should allow coefficient at maximum value (20000)", async function () {
      await proxySponsor.connect(owner).setGasCostCoefficient(20000);
      expect(await proxySponsor.gasCostCoefficient()).to.equal(20000);
    });
  });

  describe("changeOwner()", function () {
    it("should allow owner to change owner", async function () {
      const newOwnerAddress = await user.getAddress();
      await proxySponsor.connect(owner).changeOwner(newOwnerAddress);
      expect(await proxySponsor.owner()).to.equal(newOwnerAddress);
    });

    it("should revert if called by non-owner", async function () {
      const newOwnerAddress = await user.getAddress();
      await expect(
        proxySponsor.connect(user).changeOwner(newOwnerAddress)
      ).to.be.revertedWithCustomError(proxySponsor, "OnlyOwner");
    });

    it("should revert if new owner is zero address", async function () {
      await expect(
        proxySponsor.connect(owner).changeOwner(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(proxySponsor, "InvalidNewOwner");
    });

    it("should revert if new owner is same as current owner", async function () {
      const currentOwnerAddress = await owner.getAddress();
      await expect(
        proxySponsor.connect(owner).changeOwner(currentOwnerAddress)
      ).to.be.revertedWithCustomError(proxySponsor, "InvalidNewOwner");
    });
  });

  describe("withdraw()", function () {
    beforeEach(async function () {
      // Fund the contract first
      await user.sendTransaction({
        to: proxySponsorAddress,
        value: ethers.parseEther("1.0")
      });
    });

    it("should allow owner to withdraw all ETH", async function () {
      const ownerAddress = await owner.getAddress();
      const initialOwnerBalance = await ethers.provider.getBalance(ownerAddress);
      
      await proxySponsor.connect(owner).withdraw();
      
      const finalOwnerBalance = await ethers.provider.getBalance(ownerAddress);
      expect(finalOwnerBalance).to.be.gt(initialOwnerBalance);
      
      // Contract should be empty
      const contractBalance = await ethers.provider.getBalance(proxySponsorAddress);
      expect(contractBalance).to.equal(0);
    });

    it("should revert if called by non-owner", async function () {
      await expect(
        proxySponsor.connect(user).withdraw()
      ).to.be.revertedWithCustomError(proxySponsor, "OnlyOwner");
    });

    it("should revert if contract has no balance", async function () {
      // Withdraw all funds first
      await proxySponsor.connect(owner).withdraw();
      
      await expect(
        proxySponsor.connect(owner).withdraw()
      ).to.be.revertedWithCustomError(proxySponsor, "NoFundsToWithdraw");
    });
  });

  describe("changeStakeContractUSDC()", function () {
    it("should allow owner to change USDC stake contract", async function () {
      const newStakeContract = await user.getAddress();
      await proxySponsor.connect(owner).changeStakeContractUSDC(newStakeContract);
      expect(await proxySponsor.stakeContractUSDC()).to.equal(newStakeContract);
    });

    it("should revert if called by non-owner", async function () {
      const newStakeContract = await user.getAddress();
      await expect(
        proxySponsor.connect(user).changeStakeContractUSDC(newStakeContract)
      ).to.be.revertedWithCustomError(proxySponsor, "OnlyOwner");
    });

    it("should revert if new stake contract is zero address", async function () {
      await expect(
        proxySponsor.connect(owner).changeStakeContractUSDC(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(proxySponsor, "InvalidStakeContract");
    });
  });

  describe("changeStakeContractETH()", function () {
    it("should allow owner to change ETH stake contract", async function () {
      const newStakeContract = await user.getAddress();
      await proxySponsor.connect(owner).changeStakeContractETH(newStakeContract);
      expect(await proxySponsor.stakeContractETH()).to.equal(newStakeContract);
    });

    it("should revert if called by non-owner", async function () {
      const newStakeContract = await user.getAddress();
      await expect(
        proxySponsor.connect(user).changeStakeContractETH(newStakeContract)
      ).to.be.revertedWithCustomError(proxySponsor, "OnlyOwner");
    });

    it("should revert if new stake contract is zero address", async function () {
      await expect(
        proxySponsor.connect(owner).changeStakeContractETH(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(proxySponsor, "InvalidStakeContract");
    });
  });

  describe("stakeUSDC()", function () {
    it("should revert if stake contract is not set", async function () {
      // Deploy a new contract with zero stake contract address
      const ProxySponsorFactory = await ethers.getContractFactory("ProxySponsor2");
      const newProxySponsor = await ProxySponsorFactory.deploy(
        await dedicatedMsgSender.getAddress(),
        await owner.getAddress(),
        ethers.ZeroAddress, // zero USDC stake contract
        await receiver.getAddress() // mock ETH stake contract
      );
      
      await expect(
        newProxySponsor.connect(user).stakeUSDC(ethers.parseUnits("100", 6))
      ).to.be.revertedWithCustomError(newProxySponsor, "InvalidStakeContract");
    });
  });

  describe("stakeETH()", function () {
    it("should revert if stake contract is not set", async function () {
      // Deploy a new contract with zero ETH stake contract address
      const ProxySponsorFactory = await ethers.getContractFactory("ProxySponsor2");
      const newProxySponsor = await ProxySponsorFactory.deploy(
        await dedicatedMsgSender.getAddress(),
        await owner.getAddress(),
        await user.getAddress(), // mock USDC stake contract
        ethers.ZeroAddress // zero ETH stake contract
      );
      
      await expect(
        newProxySponsor.connect(user).stakeETH(ethers.parseEther("0.1"))
      ).to.be.revertedWithCustomError(newProxySponsor, "InvalidStakeContract");
    });
  });

  describe("Gas Cost Coefficient in Airdrop", function () {
    beforeEach(async function () {
      // Fund the contract
      await user.sendTransaction({
        to: proxySponsorAddress,
        value: ethers.parseEther("1.0")
      });
    });

    it("should apply coefficient to gas cost calculation", async function () {
      // Set coefficient to 110% (10% increase)
      await proxySponsor.connect(owner).setGasCostCoefficient(11000);
      
      // Create a fresh receiver
      const freshReceiver = ethers.Wallet.createRandom().connect(ethers.provider);
      const freshReceiverAddress = await freshReceiver.getAddress();
      
      const initialReceiverBalance = await ethers.provider.getBalance(freshReceiverAddress);
      
      // Perform airdrop with 5 gwei gas price
      const gasPrice = ethers.parseUnits("5", "gwei");
      await proxySponsor.connect(dedicatedMsgSender).airdrop(freshReceiverAddress, gasPrice);
      
      const finalReceiverBalance = await ethers.provider.getBalance(freshReceiverAddress);
      const transferredAmount = finalReceiverBalance - initialReceiverBalance;
      
      // The transferred amount should be higher than the base gas cost due to the 110% coefficient
      expect(transferredAmount).to.be.gt(0);
    });

    it("should use default coefficient (105%) on deployment", async function () {
      expect(await proxySponsor.gasCostCoefficient()).to.equal(10500);
    });
  });

  describe("setGasApprove()", function () {
    it("should allow owner to set gas approve value", async function () {
      const newGasApprove = 50000;
      await proxySponsor.connect(owner).setGasApprove(newGasApprove);
      expect(await proxySponsor.gasApprove()).to.equal(newGasApprove);
    });

    it("should revert if called by non-owner", async function () {
      const newGasApprove = 50000;
      await expect(
        proxySponsor.connect(user).setGasApprove(newGasApprove)
      ).to.be.revertedWithCustomError(proxySponsor, "OnlyOwner");
    });

    it("should revert if gas approve is zero", async function () {
      await expect(
        proxySponsor.connect(owner).setGasApprove(0)
      ).to.be.revertedWithCustomError(proxySponsor, "InvalidGasValue");
    });
  });

  describe("Default Gas Values", function () {
    it("should use default gas approve (40000) on deployment", async function () {
      expect(await proxySponsor.gasApprove()).to.equal(40000);
    });
  });

  describe("changeDedicatedMsgSender()", function () {
    it("should allow owner to change dedicated message sender", async function () {
      const newDedicatedMsgSender = await user.getAddress();
      await proxySponsor.connect(owner).changeDedicatedMsgSender(newDedicatedMsgSender);
      expect(await proxySponsor.dedicatedMsgSender()).to.equal(newDedicatedMsgSender);
    });

    it("should revert if called by non-owner", async function () {
      const newDedicatedMsgSender = await user.getAddress();
      await expect(
        proxySponsor.connect(user).changeDedicatedMsgSender(newDedicatedMsgSender)
      ).to.be.revertedWithCustomError(proxySponsor, "OnlyOwner");
    });

    it("should revert if new dedicated message sender is zero address", async function () {
      await expect(
        proxySponsor.connect(owner).changeDedicatedMsgSender(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(proxySponsor, "InvalidDedicatedMsgSender");
    });

    it("should revert if new dedicated message sender is same as current", async function () {
      const currentDedicatedMsgSender = await dedicatedMsgSender.getAddress();
      await expect(
        proxySponsor.connect(owner).changeDedicatedMsgSender(currentDedicatedMsgSender)
      ).to.be.revertedWithCustomError(proxySponsor, "InvalidDedicatedMsgSender");
    });
  });
}); 