const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

/**
 * Netlify Function to generate daily Etymon puzzles using OpenAI GPT
 * This can be called manually or scheduled to run daily
 */
exports.handler = async (event, context) => {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'OpenAI API key not configured' })
      };
    }

    console.log('Generating daily puzzles...');

    // Generate 5 puzzles with increasing difficulty
    const difficulties = [
      { level: 'novitiate', complexity: 'simple, common words with familiar Greek/Latin roots' },
      { level: 'disciple', complexity: 'moderate difficulty words with recognizable etymology' },
      { level: 'scholar', complexity: 'challenging words with less obvious etymological connections' },
      { level: 'magister', complexity: 'advanced vocabulary with obscure Latin roots' },
      { level: 'etymologus', complexity: 'highly sophisticated words with complex etymological origins' }
    ];

    const puzzles = [];

    for (const difficulty of difficulties) {
      const puzzle = await generatePuzzle(OPENAI_API_KEY, difficulty);
      puzzles.push(puzzle);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Create the daily puzzle object
    const dailyPuzzle = {
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      generatedAt: new Date().toISOString(),
      puzzles: puzzles
    };

    // In Netlify, we'll write to the public folder which gets deployed
    // This ensures the JSON is accessible at /daily-puzzle.json
    const publicDir = path.join(__dirname, '..', '..', 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    const filePath = path.join(publicDir, 'daily-puzzle.json');
    fs.writeFileSync(filePath, JSON.stringify(dailyPuzzle, null, 2));

    console.log('Daily puzzles generated successfully!');

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message: 'Daily puzzles generated',
        date: dailyPuzzle.date,
        puzzleCount: puzzles.length
      })
    };

  } catch (error) {
    console.error('Error generating puzzles:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to generate puzzles', 
        message: error.message 
      })
    };
  }
};

/**
 * Generate a single puzzle using GPT
 */
async function generatePuzzle(apiKey, difficulty) {
  const prompt = `You are an expert etymologist creating a word puzzle. Generate a single word with its etymology for the difficulty level: "${difficulty.level}" (${difficulty.complexity}).

Requirements:
- Choose ONE word appropriate for this difficulty level
- The word should have clear Greek or Latin etymological roots
- Provide exactly 2-3 root words (e.g., "Greek: tele, graphein" or "Latin: ob, fuscare")
- Do not include definitions or meanings in the clue - ONLY the language and root words
- Ensure the word can be guessed from its roots

Respond ONLY with valid JSON in this exact format:
{
  "word": "WORD_IN_CAPS",
  "clue": "Greek: root1, root2" or "Latin: root1, root2",
  "definition": "Brief dictionary definition",
  "briefEtymology": "From Greek/Latin root1 (meaning) and root2 (meaning)",
  "detailedEtymology": "2-3 sentences with historical context and interesting facts about the word's origin"
}

Example for ${difficulty.level} level:`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert etymologist. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 500
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content.trim();
  
  // Parse the JSON response
  let puzzle;
  try {
    // Remove markdown code blocks if present
    const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
    puzzle = JSON.parse(cleanContent);
  } catch (e) {
    console.error('Failed to parse GPT response:', content);
    throw new Error('Invalid JSON from GPT');
  }

  // Add difficulty level
  puzzle.difficulty = difficulty.level;
  puzzle.isSpeedRound = difficulty.level !== 'etymologus';
  puzzle.isFinalChallenge = difficulty.level === 'etymologus';

  return puzzle;
}
