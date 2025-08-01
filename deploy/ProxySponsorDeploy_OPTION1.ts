import { DeployFunction } from "hardhat-deploy/types";
import hre from "hardhat";

const isHardhat = hre.network.name === "hardhat";

const func: DeployFunction = async () => {
  const accounts = await hre.getNamedAccounts();


  const dedicatedMsgSender= ""

  //if (!srcNetwork) throw new Error("Unsupported network");

  await hre.deployments.deploy("ProxySponsor1", {
    from: accounts.deployer,
    args: [
     dedicatedMsgSender
    ],
    log: !isHardhat,
  });
};

func.tags = ["ProxySponsor1"];
//func.skip = async () => !isHardhat;

export default func;
