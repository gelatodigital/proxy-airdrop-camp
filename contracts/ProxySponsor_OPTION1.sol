// SPDX-License-Identifier: MIT
// solhint-disable-next-line compiler-version
pragma solidity 0.8.25;

/**
 * @title ProxySponsor
 * @dev A contract for managing airdrops
 * 
 * This contract provides the following functionality:
 * - Airdrops of native ETH to users
 * - Owner management and access control
 * - Minimum transfer value configuration
 */
contract ProxySponsor1 {
    
    /// @notice Address of the contract owner with administrative privileges
    address public owner;
    
    /// @notice Address of the dedicated message sender authorized to perform airdrops
    address public dedicatedMsgSender;
    
    /// @notice Minimum amount of ETH to transfer in airdrops (in wei)
    uint256 public minimumTransferValue;
    
    /// @notice Coefficient to multiply gas costs (in basis points, 10000 = 100%)
    uint256 public gasCostCoefficient;
    
    /// @notice Gas units for stake operation
    uint256 public gasStake;
    
    /// @notice Gas units for approve operation
    uint256 public gasApprove;
    
    // Custom errors
    /// @notice Thrown when a function is called by someone other than the owner
    error OnlyOwner();
    
    /// @notice Thrown when a function is called by someone other than the dedicated message sender
    error OnlyDedicatedMsgSender();
    
    /// @notice Thrown when the contract has insufficient balance for an operation
    error InsufficientBalance();
    
    /// @notice Thrown when an invalid receiver address (zero address) is provided
    error InvalidReceiver();
    
    /// @notice Thrown when a transfer operation fails
    error TransferFailed();
    
    /// @notice Thrown when trying to withdraw from an empty contract
    error NoFundsToWithdraw();
    
    /// @notice Thrown when an invalid minimum value (zero) is provided
    error InvalidMinimumValue();
    
    /// @notice Thrown when trying to set an invalid new owner address
    error InvalidNewOwner();
    
    /// @notice Thrown when trying to airdrop to a receiver who already has sufficient balance
    error ReceiverAlreadyFunded();
    
    /// @notice Thrown when an invalid gas cost coefficient is provided
    error InvalidGasCostCoefficient();
    
    /// @notice Thrown when an invalid gas price (zero) is provided
    error InvalidGasPrice();
    
    /// @notice Thrown when an invalid gas value (zero) is provided
    error InvalidGasValue();
    
    /// @notice Modifier to restrict function access to the contract owner only
    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }
    
    /// @notice Modifier to restrict function access to the dedicated message sender only
    modifier onlyDedicatedMsgSender() {
        if (msg.sender != dedicatedMsgSender) revert OnlyDedicatedMsgSender();
        _;
    }
    
    /**
     * @notice Constructor to initialize the ProxySponsor contract
     * @param _dedicatedMsgSender Address authorized to perform airdrops
     */
    constructor(
        address _dedicatedMsgSender
    ) {
       owner = msg.sender;
       dedicatedMsgSender = _dedicatedMsgSender;
       minimumTransferValue = 0.001 ether; // Default minimum value
       gasCostCoefficient = 10500; // Default 105% (5% increase)
       gasStake = 140000; // Default gas for stake operation
       gasApprove = 40000; // Default gas for approve operation
    }
    
    /**
     * @notice Fallback function to receive ETH deposits
     * @dev Allows the contract to receive ETH directly
     */
    receive() external payable {
        // Handle native token deposits
    }
    
    /**
     * @notice Set the minimum transfer value for airdrops
     * @param _minimumValue New minimum value in wei
     * @dev Only callable by the contract owner
     */
    function setMinimumTransferValue(uint256 _minimumValue) external onlyOwner {
        if (_minimumValue == 0) revert InvalidMinimumValue();
        minimumTransferValue = _minimumValue;
    }
    
    /**
     * @notice Set the gas cost coefficient for airdrop calculations
     * @param _coefficient New coefficient in basis points (10000 = 100%, 10500 = 105%)
     * @dev Only callable by the contract owner
     * @dev Minimum coefficient is 10000 (100%), maximum is 20000 (200%)
     */
    function setGasCostCoefficient(uint256 _coefficient) external onlyOwner {
        if (_coefficient < 10000 || _coefficient > 20000) revert InvalidGasCostCoefficient();
        gasCostCoefficient = _coefficient;
    }
    
    /**
     * @notice Set the gas units for stake operation
     * @param _gasStake New gas units for stake operation
     * @dev Only callable by the contract owner
     */
    function setGasStake(uint256 _gasStake) external onlyOwner {
        if (_gasStake == 0) revert InvalidGasValue();
        gasStake = _gasStake;
    }
    
    /**
     * @notice Set the gas units for approve operation
     * @param _gasApprove New gas units for approve operation
     * @dev Only callable by the contract owner
     */
    function setGasApprove(uint256 _gasApprove) external onlyOwner {
        if (_gasApprove == 0) revert InvalidGasValue();
        gasApprove = _gasApprove;
    }
    
    /**
     * @notice Transfer ownership of the contract to a new address
     * @param _newOwner Address of the new owner
     * @dev Only callable by the current owner
     */
    function changeOwner(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert InvalidNewOwner();
        if (_newOwner == owner) revert InvalidNewOwner();
        owner = _newOwner;
    }


    
    /**
     * @notice Calculate the required amount for an airdrop based on gas costs and minimum value
     * @param gasPrice The gas price to use for calculations
     * @return The required amount in wei (maximum of gas cost or minimum transfer value)
     * @dev Internal helper function for airdrop calculations
     * @dev Applies gas cost coefficient to adjust the calculated amount
     */
    function _calculateRequiredAmount(uint256 gasPrice) internal view returns (uint256) {
        uint256 totalGasCost = (gasStake + gasApprove) * gasPrice;
        
        // Apply coefficient to gas cost (in basis points)
        uint256 adjustedGasCost = (totalGasCost * gasCostCoefficient) / 10000;
        
        return adjustedGasCost > minimumTransferValue 
            ? adjustedGasCost 
            : minimumTransferValue;
    }
    
    /**
     * @notice Calculate the actual transfer amount needed for a receiver
     * @param receiver Address of the receiver
     * @param requiredAmount Total amount required by the receiver
     * @return The difference amount to transfer (requiredAmount - receiverBalance)
     * @dev Reverts if receiver already has sufficient balance
     */
    function _calculateTransferAmount(address receiver, uint256 requiredAmount) internal view returns (uint256) {
        uint256 receiverBalance = receiver.balance;
        
        if (receiverBalance >= requiredAmount) revert ReceiverAlreadyFunded();
        
        return requiredAmount - receiverBalance;
    }
    
    /**
     * @notice Perform an airdrop of ETH to a receiver
     * @param receiver Address of the receiver to airdrop ETH to
     * @param gasPrice The gas price to use for calculations (in wei)
     * @dev Only callable by the dedicated message sender
     * @dev Calculates required amount based on gas costs and minimum transfer value
     * @dev Only transfers the difference if receiver already has partial balance
     */
    function airdrop(
        address receiver,
        uint256 gasPrice
    ) external onlyDedicatedMsgSender {
        if (address(this).balance == 0) revert InsufficientBalance();
        if (receiver == address(0)) revert InvalidReceiver();
        if (gasPrice == 0) revert InvalidGasPrice();
        
        uint256 requiredAmount = _calculateRequiredAmount(gasPrice);
        uint256 transferAmount = _calculateTransferAmount(receiver, requiredAmount);
       
        if (address(this).balance < transferAmount) revert InsufficientBalance();

        // TODO: add a check to see if the receiver is a valid address
        (bool success, ) = payable(receiver).call{value: transferAmount}("");
        if (!success) revert TransferFailed();
    }
    
    /**
     * @notice Withdraw all ETH from the contract to the owner
     * @dev Only callable by the contract owner
     * @dev Transfers the entire contract balance to the owner
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NoFundsToWithdraw();
        
        (bool success, ) = payable(owner).call{value: balance}("");
        if (!success) revert TransferFailed();
    }



}
