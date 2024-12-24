// Importing ethers library from Ethers.js
const { ethers } = require('ethers');

// Configuration for the Ethereum node WebSocket URL
const config = { ETH_NODE_WSS: 'wss://rpc.maximoscan.xyz' };
// Using console for logging
const logger = console;

// Constants for WebSocket connection management
const EXPECTED_PONG_BACK = 15000; // Time to wait for a pong response in milliseconds
const KEEP_ALIVE_CHECK_INTERVAL = 7500; // Interval for sending ping messages in milliseconds
const MAX_RECONNECT_ATTEMPTS = 5; // Maximum number of reconnection attempts
const RECONNECT_INTERVAL_BASE = 1000; // Base delay in milliseconds for reconnections
const SIMULATE_DISCONNECT_INTERVAL = 30000; // Interval to simulate disconnection (e.g., 30 seconds)

// Toggle for the disconnect simulation feature
const simulateDisconnect = true; // Set to false to disable disconnect simulation

// Variable to track the number of reconnection attempts
let reconnectAttempts = 0;

// Function to simulate a broken connection
function simulateBrokenConnection(provider) {
    logger.warn('Simulating broken WebSocket connection');
    provider.websocket.close();
}

// Function to start and manage the WebSocket connection
function startConnection() {
    // Initializing WebSocket provider with the Ethereum node URL
    let provider = new ethers.WebSocketProvider(config.ETH_NODE_WSS);

    // Variables for managing keep-alive mechanism
    let pingTimeout = null;
    let keepAliveInterval = null;

    // Function to schedule a reconnection attempt
    function scheduleReconnection() {
        // Check if maximum reconnection attempts haven't been reached
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            // Calculate delay for reconnection based on the number of attempts
            let delay = RECONNECT_INTERVAL_BASE * Math.pow(2, reconnectAttempts);
            // Schedule next reconnection attempt
            setTimeout(startConnection, delay);
            reconnectAttempts++;
            logger.log(`Scheduled reconnection attempt ${reconnectAttempts} in ${delay} ms`);
        } else {
            logger.error('Maximum reconnection attempts reached. Aborting.');
        }
    }

    // Event listener for 'open' event on WebSocket connection
    provider.websocket.on('open', () => {
        reconnectAttempts = 0;
        keepAliveInterval = setInterval(() => {
            logger.debug('Checking if the connection is alive, sending a ping');
            provider.websocket.ping();

            pingTimeout = setTimeout(() => {
                logger.error('No pong received, terminating WebSocket connection');
                provider.websocket.terminate();
            }, EXPECTED_PONG_BACK);
        }, KEEP_ALIVE_CHECK_INTERVAL);

        // Schedule a simulated disconnect if the feature is enabled
        if (simulateDisconnect) {
            setTimeout(() => simulateBrokenConnection(provider), SIMULATE_DISCONNECT_INTERVAL);
        }
    });

    // Event listener for 'close' event on WebSocket connection
    provider.websocket.on('close', () => {
        logger.error('The websocket connection was closed');
        clearInterval(keepAliveInterval);
        clearTimeout(pingTimeout);
        scheduleReconnection();
    });

    // Event listener for 'pong' response to ping
    provider.websocket.on('pong', () => {
        logger.debug('Received pong, connection is alive');
        clearTimeout(pingTimeout);
    });

    // Event listener for new blocks on the Ethereum blockchain
    provider.on('block', (blockNumber) => {
        logger.log(`New Block: ${blockNumber}`);
    });

    // Event listener for errors on WebSocket connection
    provider.on('error', (error) => {
        logger.error('WebSocket error:', error);
        scheduleReconnection();
    });
}

// Initiate the connection
startConnection();