//Raffle
//Enter The Lottery (Paying some amount)
//Pick a random winer
//Winner is to be selected every X minutes -> Completely Automated
//Chainlink Oracle -> Randomness, Automated Execution (ChainLink Kepers)

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/KeeperCompatible.sol";

error Raffle__NotEnoughEthEntered();
error Raffle__TransferFailed();
error Raffle__NotOpen();
error Raffle__UpkeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 raffleState);

/// @title A Sample Raffle Contract
/// @author Ifechukwu Daniel
/// @notice This is a decentralized raffle contract
/// @dev This Implements chainlink vrf v2 for randomness and chainlink keepers for time automation

contract Raffle  is VRFConsumerBaseV2,KeeperCompatibleInterface {

    //Type Deceleration
    enum RaffleState { 
        OPEN, 
        CALCULATING 
    }

    // State Variables
    uint256 private immutable i_entranceFee;
    address payable[] private s_players; 
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 2;
    uint32 private immutable i_callbackGasLimit; 


    //Lottery Variables 
    address private s_recentWinner;
    RaffleState private s_raffleState;
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval;

    //Events
    event RaffleEnter(address indexed player);
    event RequestRaffleWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winnerPicked);

    //Functions
    constructor(
        address vrfCoordinatorV2 ,
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId= subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_raffleState = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
    }

    function enterRaffle() public payable  {
        if(s_raffleState != RaffleState.OPEN) {
            revert Raffle__NotOpen();
        }

        if (msg.value<i_entranceFee) { 
            revert Raffle__NotEnoughEthEntered();
        }

        s_players.push(payable(msg.sender));
        /// Call Raffle Event
        emit RaffleEnter(msg.sender);
    }

    /// @dev This is the function that the chainlink 
    /// keeper node call and return true to call performUpKeep
    /// The Following should be true in order to return true
    /// 1. Our time interval should have passed
    /// 2. Our Lottery should ave at least one player and some eth
    /// 3.Our subscription is funded with link
    /// 4. The Lottery should be in an open state

    function checkUpkeep(bytes memory /* checkData */) public view  override returns (bool upkeepNeeded , bytes memory /*performData*/) {
      bool isOpen = (RaffleState.OPEN == s_raffleState);
      bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
      bool hasPlayers = (s_players.length > 0);
      bool hasBalance = address(this).balance > 0;
      upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
    }


    function performUpkeep(bytes calldata /* performData */) external override {
        (bool upkeepNeeded,) = checkUpkeep("");
        if(!upkeepNeeded){
            revert Raffle__UpkeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_raffleState)
            );
        }
        //request a random number
        //Once we get it do something with it 
        s_raffleState = RaffleState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
         i_gasLane,
         i_subscriptionId,
         REQUEST_CONFIRMATIONS, 
         i_callbackGasLimit, 
         NUM_WORDS);
         
         emit RequestRaffleWinner(requestId);
    }

    function  fulfillRandomWords( uint256 /*requestId*/ ,uint256[] memory randomWords) internal override {
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        s_raffleState = RaffleState.OPEN;
        s_players = new address payable[](0);
        s_lastTimeStamp = block.timestamp;
        (bool success,) = recentWinner.call{value:address(this).balance}("");
        if(!success){
            revert Raffle__TransferFailed();
        }
        emit WinnerPicked(recentWinner);
    }


    // View \ Pure Function
    function getEntranceFee() public view  returns (uint256) {
        return i_entranceFee;
    }
    
    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getRecentWinner() view public returns (address) {
        return s_recentWinner;
    }

    function getRaffleState() view public returns (RaffleState) {
         return s_raffleState;
    }

    function getNumWords() pure public returns (uint32) {
        return NUM_WORDS;
    }

    function getNumberOfPlayers() view public returns (uint256) {
        return s_players.length;
    }

    function getLatestTimestamp() view public returns (uint256) {
        return s_lastTimeStamp;
    }

    function getRequestConfirmation() pure public returns (uint16) {
         return REQUEST_CONFIRMATIONS;
    }
    
    function getInterval() view public returns (uint256){
        return i_interval;
    }
}