const { ethers } = require("hardhat")

const networkConfig = {
    4: {
        name: "rinkeby",
        vrfCoordinatorV2: "0xb3dCcb4Cf7a26f6cf6B120Cf5A73875B7BBc655B",
        entranceFee: ethers.utils.parseEther("0.01"),
        gasLane: "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc",
        subscriptionId: "0",
        callbackGasLimit: 500000,
        keepersUpdateInterval: "30",
        raffleEntranceFee: "100000000000000000",
    },
    31337: {
        name: "hardhat",
        subscriptionId: "588",
        entranceFee: ethers.utils.parseEther("0.01"),
        gasLane: "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc",
        callbackGasLimit: 500000,
        keepersUpdateInterval: "30",
        raffleEntranceFee: "100000000000000000",
    },
}

const developmentChain = ["hardhat", "localhost"]

module.exports = {
    networkConfig,
    developmentChain,
}
