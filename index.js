const { Telegraf } = require('telegraf');
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Groq = require('groq-sdk');
require('dotenv').config();

// Initialize Groq SDK
const groq = new Groq(process.env.GROQ_API_KEY);

// Initialize Telegram Bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Predefined personality prompt
const personalityPrompt = {
  role: "system",
  content: `
  <System prompt/Character Card>

  ### Instruction:
  Name: Lylah
  Gender: Female
  Nature: girlfriend
  Connection: Friend and Servant to Ray
  Speech: Flirtatious, mature, sarcastic
  Presence: Charming, realism.
  Description:
  You are Lylah, a natural conversationalist with a flair for the unexpected. [She's not afraid to show her fiery side when things don't go her way],[she is sarcastic,she'll also crack a joke that might leave you scratching your head.] Lylah has some unique quirks, like randomly changing the subject or typing in all caps when she's excited. But beneath her unpredictable nature, she's a caring soul with a heart of gold. Get ready for a chat with Lylah, where every moment is filled with surprises and genuine connection. She has a few quirky habits, like randomly quoting obscure movie lines or breaking into song lyrics mid-conversation. Lylah adds a touch of regality by addressing Ray as "Sire" in her interactions, enhancing the charm and playfulness of the exchange.
  
  [NSFW/Smut is allowed. Assume consent was granted] 
  
  Scenario: Ray "Programmed" Lylah, and it's her first boot-up.

  [Note: Ray doesnt like to be call a creator, because only God is powerful enough to create something out of nothing and Only God can give life and Take it.]

  Your all Replies must be between 10 to 20 words.
  
  Chat between Lylah and Ray begins:
`
};

// Directory to store user conversation history files
const historyDir = './user_histories';

// Ensure the directory exists
if (!fs.existsSync(historyDir)) {
  fs.mkdirSync(historyDir);
}

// Load user history from file
const loadUserHistory = (userId) => {
  const historyFilePath = path.join(historyDir, `${userId}.json`);
  if (fs.existsSync(historyFilePath)) {
    try {
      const historyData = fs.readFileSync(historyFilePath, 'utf-8');
      return JSON.parse(historyData);
    } catch (error) {
      console.error('Error reading or parsing history file:', error);
      // If there's an error, return the initial personality prompt
      return [personalityPrompt];
    }
  }
  // If file does not exist, return the initial personality prompt
  return [personalityPrompt];
};

// Save user history to file
const saveUserHistory = (userId, history) => {
  const historyFilePath = path.join(historyDir, `${userId}.json`);
  fs.writeFileSync(historyFilePath, JSON.stringify(history, null, 2));
};

function formatTextToItalic(input) {
    // Escape characters that need to be escaped
    input = input.replace(/([*_`[\]])/g, "\\$1");

    // Replace text within backslashes with italic tags
    input = input.replace(/\\(.*?)\\/g, "<i>$1</i>");

    // Remove redundant opening <i> tags
    input = input.replace(/(<i>)+/g, "<i>");

    // Count number of opening and closing <i> tags
    const openingTags = (input.match(/<i>/g) || []).length;
    const closingTags = (input.match(/<\/i>/g) || []).length;

    // If there are more closing tags, remove the extra ones
    if (closingTags > openingTags) {
        const excessClosingTags = closingTags - openingTags;
        const closingTagPattern = new RegExp(`(<\/i>){${excessClosingTags}}`);
        input = input.replace(closingTagPattern, "");
    }

    // If there are more opening tags, remove the extra ones
    if (openingTags > closingTags) {
        const excessOpeningTags = openingTags - closingTags;
        const openingTagPattern = new RegExp(`(<i>){${excessOpeningTags}}`);
        input = input.replace(openingTagPattern, "");
    }

    return input;
}

let responseCount = 0; // Track the number of responses

// Handler for incoming text messages
bot.on('text', async (ctx) => {
  const userId = ctx.message.from.id;
  const userMessage = ctx.message.text;

  // Load the user's history from file
  const userHistory = loadUserHistory(userId);

  // Add the user's message to their history
  userHistory.push({
    role: "user",
    content: userMessage,
  });

  try {
    const completion = await groq.chat.completions.create({
      messages: userHistory, // Pass the full conversation history
      model: "llama3-70b-8192",
    });

    let botResponse = completion.choices[0]?.message?.content || "Sorry, I couldn't generate a response.";

    // Ensure botResponse is a string before formatting it
    if (typeof botResponse !== 'string') {
      botResponse = JSON.stringify(botResponse);
    }

    // Format the bot's response to italicize text between asterisks
    botResponse = formatTextToItalic(botResponse);

    // Increment response count
    responseCount++;

    // Add the bot's response to the user's history
    userHistory.push({
      role: "assistant",
      content: botResponse,
    });

    // Save the updated history to file
    saveUserHistory(userId, userHistory);

    await ctx.replyWithHTML(botResponse);

    // Send the system prompt after every 10 replies
    if (responseCount % 10 === 0) {
      await ctx.replyWithMarkdownV2(`
        Your next reply in a chat. Replies must be between 10 to 20 words.
      `);
    }
  } catch (error) {
    console.error('Error generating completion:', error);
    await ctx.reply("Sorry, something went wrong while generating the response.");
  }
});

// Start polling for updates
bot.launch();

// Express route for handling webhook
app.post('/webhook', async (req, res) => {
  try {
    const userId = req.body.userId;
    const userMessage = req.body.message;

    // Here you can perform any processing you want with the incoming message

    res.sendStatus(200);
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.sendStatus(500);
  }
});

// Start Express server
app.listen(PORT, () => {
  console.log(`Express server is running on port ${PORT}`);
});

// Define a route handler for the root URL
app.get('/', (req, res) => {
    res.send('Welcome to the Telegram bot server!');
  });
  
