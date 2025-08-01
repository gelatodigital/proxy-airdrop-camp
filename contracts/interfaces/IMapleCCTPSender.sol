// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Authorization} from "../types/Authorization.sol";

interface IMapleCCTPSender {
    event LogBridge(address indexed sponsor, uint256 amount);

    function bridgeAndDeposit(
        address _owner,
        uint256 _amount,
        Authorization calldata _authorization
    ) external;
}
