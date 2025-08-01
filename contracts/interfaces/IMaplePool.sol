// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;


interface IMaplePool {
    function depositToken(
        address sponsor,
        uint256 amount
    ) external;
}
