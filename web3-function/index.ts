import {
  Web3Function,
  Web3FunctionEventContext,
} from "@gelatonetwork/web3-functions-sdk";

import {Interface } from "ethers";
import oftTokenAbi from "./oftTokenABI.json";
import { Contract } from "ethers";

const proxyAbi = ["function airdrop(address,uint256)"];

Web3Function.onRun(async (context: Web3FunctionEventContext) => {
  const { log, userArgs, multiChainProvider } = context;

  const provider : any = multiChainProvider.default();
  const gasPrice = await provider.getFeeData();
  const proxyContractAddress : string = userArgs.proxyContractAddress as string;
  const oftToken = new Interface(oftTokenAbi.abi);
  const proxyContract = new Contract(proxyContractAddress, proxyAbi, provider);
  const event = await oftToken.parseLog(log);

  if (!event) {
    return {
      canExec: false,
      message: "No event found",
    };
  }

  const {guid, srcEid, toAddress, amountReceivedLD} = event.args;

  return {
     canExec: true,
     callData: [
       {
         to: proxyContractAddress,
         data: proxyContract.interface.encodeFunctionData("airdrop", [toAddress, BigInt(gasPrice.maxFeePerGas)]),
       },
     ],
   };
});
  