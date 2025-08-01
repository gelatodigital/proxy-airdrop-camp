# Proxy Airdrop Contracts

This repository contains two different implementations of proxy airdrop contracts.

## Contract Options

### 1. ProxySponsor_OPTION1 (Simplified)
**File:** `contracts/ProxySponsor_OPTION1.sol`

A streamlined proxy contract focused solely on efficient airdrop operations without additional complexity.

#### Features:
- ✅ **Smart Airdrop Logic** - Prevents over-funding by checking receiver balance
- ✅ **Gas Cost Calculation** - Dynamic gas cost calculation for optimal transfers adding approve and stake txs
- ✅ **Gas Cost Coefficient** - Configurable multiplier for gas cost calculations (default: 105%)
- ✅ **Minimum Transfer Value** - Configurable minimum airdrop amounts


#### Constructor Parameters:
```solidity
constructor(address _dedicatedMsgSender)
```

---

### 2. ProxySponsor (Full Featured)
**File:** `contracts/ProxySponsor.sol`

A comprehensive proxy contract with advanced features including gasless transactions and staking capabilities.

#### Features:
- ✅ **Smart Airdrop Logic** - Prevents over-funding by checking receiver balance
- ✅ **Gas Cost Calculation** - Dynamic gas cost calculation for optimal transfers only considering approve
- ✅ **Gas Cost Coefficient** - Configurable multiplier for gas cost calculations (default: 105%)
- ✅ **Minimum Transfer Value** - Configurable minimum airdrop amounts
- ✅ **Gasless USDC Staking** - Integration with external USDC staking contracts
- ✅ **Gasless ETH Staking** - Integration with external ETH staking contracts


#### Constructor Parameters:
```solidity
constructor(
    address _dedicatedMsgSender,
    address _trustedForwarder,
    address _stakeContractUSDC,
    address _stakeContractETH
)
```

---


## Technical Architecture

### State Variables
Both contracts maintain:
- `owner` - Contract administrator
- `dedicatedMsgSender` - Authorized airdrop caller
- `minimumTransferValue` - Minimum ETH transfer amount
- `gasCostCoefficient` - Gas cost multiplier in basis points (default: 10500 = 105%)
- `gasApprove` - Gas units for approve operation (default: 40000)

**ProxySponsor_OPTION1 Additional:**
- `gasStake` - Gas units for stake operation (default: 140000)

### Core Airdrop Functionality
```solidity
function airdrop(address receiver, uint256 gasPrice) external onlyDedicatedMsgSender
```
- Transfers ETH to receiver based on provided gas price and gas costs or minimum value
- Prevents over-funding by checking receiver's current balance
- Only callable by the dedicated message sender
- Validates that gas price is not zero

### Admin Functions
```solidity
function setMinimumTransferValue(uint256 _minimumValue) external onlyOwner
function setGasCostCoefficient(uint256 _coefficient) external onlyOwner
function setGasApprove(uint256 _gasApprove) external onlyOwner
function changeDedicatedMsgSender(address _newDedicatedMsgSender) external onlyOwner
function changeOwner(address _newOwner) external onlyOwner
function withdraw() external onlyOwner
```

**ProxySponsor_OPTION1 Additional:**
```solidity
function setGasStake(uint256 _gasStake) external onlyOwner
```

## Setup and Testing

### Installation
```bash
npm install
```

### Compilation
```bash
npx hardhat compile
```

### Testing
```bash
# Test both contracts
npx hardhat test --network hardhat

# Test specific contract
npx hardhat test test/proxy-sponsor.ts --network hardhat
npx hardhat test test/proxy-sponsor-option1.ts --network hardhat
```

### Test Coverage
- **ProxySponsor_OPTION1**: 36 tests covering core functionality
- **ProxySponsor_OPTION2**: 42 tests covering all features


## Security Considerations

### Both Contracts
- ✅ **Access Control** - Proper modifier usage
- ✅ **Reentrancy Protection** - No external calls in critical functions
- ✅ **Input Validation** - Comprehensive parameter checks
- ✅ **Custom Errors** - Gas-efficient error handling

### ProxySponsor_OPTION2 Additional
- ✅ **ERC2771 Security** - Trusted forwarder validation
- ✅ **Staking Integration** - External contract validation
- ✅ **Advanced Admin** - Stake contract management

## License

MIT 