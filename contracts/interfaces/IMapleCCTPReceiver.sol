// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

interface IMapleCCTPReceiver {
    function receiveAndDeposit(
        address _sponsor,
        bytes calldata _message,
        bytes calldata _attestation
    ) external;
}
