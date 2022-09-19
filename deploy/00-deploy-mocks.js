const { network, ethers } = require("hardhat")
const { developmentChain } = require("../helper-hardhat-config")

const BASE_FEE = ethers.utils.parseEther("0.25") //it cost 0.25 link per request
const GAS_PRICE_LINK = 1e9 // link per gas, is this the gas lane? // 0.000000001 LINK per gas

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    const args = [BASE_FEE, GAS_PRICE_LINK]

    if (developmentChain.includes(network.name)) {
        //deploying  mock contract
        log("Local network detected! deploying mocks ...")
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args,
        })
        log("Mocks Deployed")
        log("---------------------------------")
    }
}

module.exports.tags = ["all", "mocks"]
