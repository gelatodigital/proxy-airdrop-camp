// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

interface IMessageTransmitter {
    event MessageSent(bytes message);

    function receiveMessage(
        bytes calldata message,
        bytes calldata attestation
    ) external returns (bool success);
}
