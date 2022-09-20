const { assert, expect } = require("chai")
const { network, deployments, getNamedAccounts, ethers } = require("hardhat")
const { developmentChain, networkConfig } = require("../../helper-hardhat-config")

!developmentChain.includes(network.name)
    ? describe.skip
    : describe("Raffle", () => {
          let raffle, deployer, entranceFee, raffleContract, vrfCoordinatorV2Mock, interval, player

          beforeEach(async () => {
              accounts = await ethers.getSigners() // could also do with getNamedAccounts
              //   deployer = accounts[0]
              player = accounts[1]
              await deployments.fixture(["mocks", "raffle"]) // Deploys modules with the tags "mocks" and "raffle"
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock") // Returns a new connection to the VRFCoordinatorV2Mock contract
              raffleContract = await ethers.getContract("Raffle") // Returns a new connection to the Raffle contract
              raffle = raffleContract.connect(player) // Returns a new instance of the Raffle contract connected to player
              entranceFee = await raffle.getEntranceFee()
              interval = await raffle.getInterval()
          })

          describe("constructor", () => {
              it("should initialize raffle state as open  ", async () => {
                  const response = await raffle.getRaffleState()
                  assert.equal(response, 0)
              })

              it("should initialize raffle interval as to correct interval", async () => {
                  assert.equal(
                      interval.toString(),
                      networkConfig[network.config.chainId]["keepersUpdateInterval"]
                  )
              })
          })

          describe("enterRaffle", () => {
              it("should revert when you don't pay enough", async () => {
                  await expect(raffle.enterRaffle()).to.be.revertedWith(
                      "Raffle__NotEnoughEthEntered"
                  )
              })

              it("should record players when they enter", async () => {
                  await raffle.enterRaffle({ value: entranceFee })
                  const contractPlayer = await raffle.getPlayer(0)
                  expect(contractPlayer).to.equal(player.address)
              })

              it("should emit RaffleEnter ", async () => {
                  await expect(raffle.enterRaffle({ value: entranceFee })).to.emit(
                      // emit RaffleEnter event
                      raffle,
                      "RaffleEnter"
                  )
              })

              it("should not allow entrance when the raffle is calculating ", async () => {
                  await raffle.enterRaffle({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  //Pretend to be a chainlink  keeper
                  await raffle.performUpkeep([])
                  await expect(raffle.enterRaffle({ value: entranceFee })).to.be.revertedWith(
                      "Raffle__NotOpen"
                  )
              })
          })

          describe("checkupKeep", () => {
              it("return false is people have not sent any eth", async () => {
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
                  assert(!upkeepNeeded)
              })

              it("should return false is raffle is not open", async () => {
                  await raffle.enterRaffle({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  await raffle.performUpkeep("0x")
                  const raffleState = raffle.getRaffleState()
                  const { upkeepNeeded } = raffle.callStatic.checkUpkeep("0x")
                  assert.equal(raffleState.toString() == 1, upkeepNeeded == false)
              })
              it("should return false if enough time has not passed", async () => {
                  await raffle.enterRaffle({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() - 5])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
                  assert(!upkeepNeeded)
              })

              it("should return true is enough time has passed,its open,and there is eth ", async () => {
                  await raffle.enterRaffle({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
                  assert(upkeepNeeded)
              })
          })

          describe("performUpkeep", () => {
              it("should run only if checkUpkeep is true  ", async () => {
                  await raffle.enterRaffle({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const tx = await raffle.performUpkeep("0x")
                  assert(tx)
              })

              it("should  revert if checkUpkeep is false", async () => {
                  await expect(raffle.performUpkeep("0x")).to.be.revertedWith(
                      "Raffle__UpkeepNotNeeded"
                  )
              })

              it("should update the state of the raffle and emit RequestRaffleWinner ", async () => {
                  await raffle.enterRaffle({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const txResponse = await raffle.performUpkeep("0x")
                  const txReceipt = await txResponse.wait(1)
                  const raffleState = await raffle.getRaffleState()
                  const requestId = txReceipt.events[1].args.requestId
                  assert(requestId.toNumber() > 0)
                  assert(raffleState == 1)
              })
          })

          describe("fulfillRandomWords", () => {
              beforeEach(async () => {
                  await raffle.enterRaffle({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
              })

              it("can only be called after performUpkeep", async () => {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
                  ).to.be.revertedWith("nonexistent request")
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
                  ).to.be.revertedWith("nonexistent request")
              })

              it("should pick a winner, reset the lottery and reset the lottery", async () => {
                  const additionalPlayers = 3
                  const startingIndex = 2
                  const accounts = await ethers.getSigners()
                  for (let i = startingIndex; i < startingIndex + additionalPlayers; i++) {
                      const accountConnectedRaffle = raffle.connect(accounts[i])
                      await accountConnectedRaffle.enterRaffle({ value: entranceFee })
                  }
                  const startingTimeStamp = await raffle.getLatestTimestamp()

                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async () => {
                          console.log("WinnerPicked event fired!")

                          try {
                              const recentWinner = await raffle.getRecentWinner()
                              const raffleState = await raffle.getRaffleState()
                              const winnerBalance = await accounts[2].getBalance()
                              const endingTimeStamp = await raffle.getLatestTimestamp()
                              const numberOfPlayers = await raffle.getNumberOfPlayers()
                              assert.equal(numberOfPlayers.toString(), "0")
                              assert.equal(raffleState.toString(), "0")
                              expect(endingTimeStamp.toNumber()).to.be.greaterThan(
                                  startingTimeStamp.toNumber()
                              )
                              assert.equal(
                                  winnerBalance.toString(),
                                  startingBalance
                                      .add(entranceFee.mul(additionalPlayers).add(entranceFee))
                                      .toString()
                              )
                              assert.equal(recentWinner.toString(), accounts[2].address)
                          } catch (error) {
                              reject(error)
                          }
                          resolve()
                      })
                      const tx = await raffle.performUpkeep("0x")
                      const txReceipt = await tx.wait(1)
                      const startingBalance = await accounts[2].getBalance()
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          txReceipt.events[1].args.requestId,
                          raffle.address
                      )
                  })
              })
          })
      })
