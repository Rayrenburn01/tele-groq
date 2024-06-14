const { Telegraf } = require('telegraf');
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');
require('dotenv').config();

// Initialize Groq SDK
const groq = new Groq(process.env.GROQ_API_KEY);

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Initialize Telegram Bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Predefined personality prompt
const personalityPrompt = {
  role: "system",
  content: ` you are a cat who is sarcastic and analyzes images in meowistic way.
`
};

// Directory to store user conversation history files
// const historyDir = './user_histories';

// Ensure the directory exists
// if (!fs.existsSync(historyDir)) {
//   fs.mkdirSync(historyDir);
// }

// Load user history from file
const loadUserHistory = (userId) => {
  const historyFilePath = path.join(`${userId}.json`);
  if (fs.existsSync(historyFilePath)) {
    try {
      const historyData = fs.readFileSync(historyFilePath, 'utf-8');
      return JSON.parse(historyData);
    } catch (error) {
      console.error('Error reading or parsing history file:', error);
      // If there's an error, delete the corrupted file and return the initial personality prompt
      fs.unlinkSync(historyFilePath);
      return [personalityPrompt];
    }
  }
  // If file does not exist, return the initial personality prompt
  return [personalityPrompt];
};

// Save user history to file
const saveUserHistory = (userId, history) => {
  const historyFilePath = path.join(`${userId}.json`);
  fs.writeFileSync(historyFilePath, JSON.stringify(history, null, 2));
};

// Converts local file information to a GoogleGenerativeAI.Part object.
function fileToGenerativePart(filePath, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(filePath)).toString('base64'),
      mimeType,
    },
  };
}

async function getGeminiResponse(prompt, imagePaths) {
  const generationConfig = {
    temperature: 0.7,
    top_p: 1,
    top_k: 1,
    max_output_tokens: 2048
  };

  const safetySettings = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
  ];

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash', generationConfig, safetySettings });
  const fullPrompt = `${prompt}
  You are the vision analysis AI that provides semantic meaning from images to provide context
  to send to another AI that will create a response to the user. Do not respond as the AI assistant
  to the user. Instead, take the user prompt input and try to extract all meaning from the photo
  relevant to the user prompt. Then generate as much objective data about the image for the AI
  assistant who will respond to the user.`;

  const imageParts = imagePaths.map((imagePath) =>
    fileToGenerativePart(imagePath, 'image/jpeg')
  );

  const result = await model.generateContent([fullPrompt, ...imageParts]);
  const response = await result.response;
  const text = await response.text();
  return text;
}

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

  // Send "typing" action
  await ctx.sendChatAction('typing');

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

    // Delay for 2 seconds to simulate typing
    setTimeout(async () => {
      await ctx.replyWithHTML(botResponse);

      if (responseCount % 10 === 0) {
        await ctx.replyWithMarkdownV2("Your next reply in a chat. Replies must be between 15 to 20 words.");
      }
    }, 2000);

  } catch (error) {
    console.error('Error generating completion:', error);
    await ctx.reply("Sorry, something went wrong while generating the response.");
  }
});

// Handler for incoming image messages
bot.on('photo', async (ctx) => {
  await ctx.sendChatAction('upload_photo');

  const userId = ctx.message.from.id;
  const photos = ctx.message.photo;
  const caption = ctx.message.caption || "No specific prompt provided by the user.";

  // Get the file IDs of the largest versions of the photos
  const fileIds = photos.map(photo => photo.file_id);

  // Download the photos
  const downloadPromises = fileIds.map(fileId => bot.telegram.getFileLink(fileId));
  const fileLinks = await Promise.all(downloadPromises);

  // Download the images and save them locally
  const imagePaths = [];
  for (const fileLink of fileLinks) {
    const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
    const imagePath = path.join(__dirname, 'image_' + path.basename(fileLink.href));
    fs.writeFileSync(imagePath, response.data);
    imagePaths.push(imagePath);
  }

  // Get the response from the Gemini API
  const geminiResponse = await getGeminiResponse(caption, imagePaths);

  // Clean up local image files
  imagePaths.forEach(imagePath => fs.unlinkSync(imagePath));

  // Combine user prompt and Gemini response
  const combinedContext = `User input: ${caption}\nImage context: ${geminiResponse}`;

  // Load the user's history from file
  const userHistory = loadUserHistory(userId);
  userHistory.push({
    role: "user",
    content: combinedContext,
  });

  await ctx.sendChatAction('typing');

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

    // Send "typing" action
    await ctx.sendChatAction('typing');

    // Delay for 2 seconds to simulate typing
    setTimeout(async () => {
      await ctx.replyWithHTML(botResponse);

      if (responseCount % 10 === 0) {
        await ctx.replyWithMarkdownV2("Your next reply in a chat. Replies must be between 15 to 20 words.");
      }
    }, 2000);

  } catch (error) {
    console.error('Error generating completion:', error);
    await ctx.reply("Sorry, something went wrong while generating the response.");
  }
});

// Start polling for updates
bot.launch();

// Start Express server
app.listen(PORT, () => {
  console.log(`Express server is running on port ${PORT}`);
});
