# Telegram AI Assistant Bot

## Overview
This Node.js application creates a Telegram bot capable of generating responses based on user input, including text and images. It integrates various APIs and libraries to provide a seamless conversational experience.

## Features
- Responds to text messages using AI-generated completions from Groq.
- Processes images along with accompanying text to generate context-aware responses using Google Generative AI.
- Maintains conversation history for each user to ensure context continuity.
- Utilizes Express for handling webhook requests and serving as a web server.

## Prerequisites
Before running the bot, ensure you have the following installed and set up:
- Node.js and npm
- Telegram Bot API token
- Google Generative AI API key
- Groq API key
- Environmental variables set up in a .env file (see .env.example for required variables)

## Installation
1. Clone this repository to your local machine.
2. Install dependencies using npm:
    ```bash
    npm install
    ```
3. Set up environmental variables by creating a .env file in the root directory and adding necessary keys (see .env.example for reference).

## Usage
1. Start the Express server:
    ```bash
    npm start
    ```
2. Launch the Telegram bot by running the script:
    ```bash
    node index.js
    ```
3. Interact with the bot on Telegram. Send text messages or images with optional captions to receive responses.

## File Structure
- **index.js**: Entry point of the application containing bot logic and event handlers.
- **utils/**: Directory containing utility functions used in the application.
- **user_histories/**: Directory to store user conversation history files (currently disabled).

## Contributing
Contributions are welcome! Please feel free to submit issues or pull requests for any improvements or fixes.


