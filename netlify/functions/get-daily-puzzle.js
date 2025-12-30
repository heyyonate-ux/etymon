const fetch = require('node-fetch');

/**
 * Serves today's daily puzzle
 * Generates new puzzles if needed, otherwise returns cached
 */
exports.handler = async (event, context) => {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      return fallbackPuzzles();
    }

    const today = new Date().toISOString().split('T')[0];
    
    // For demo/development: generate new puzzles each time
    // In production, you'd check a database or cache here
    console.log(`Generating puzzles for ${today}`);
    
    const puzzles = await generateAllPuzzles(OPENAI_API_KEY);
    
    const dailyPuzzle = {
      date: today,
      generatedAt: new Date().toISOString(),
      puzzles: puzzles
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      },
      body: JSON.stringify(dailyPuzzle)
    };

  } catch (error) {
    console.error('Error generating puzzles:', error);
    
    // Return fallback puzzles on error
    return fallbackPuzzles();
  }
};

/**
 * Generate all 5 puzzles concurrently (faster!)
 */
async function generateAllPuzzles(apiKey) {
  const difficulties = [
    { level: 'novitiate', complexity: 'simple, common words with familiar Greek/Latin roots' },
    { level: 'disciple', complexity: 'moderate difficulty words with recognizable etymology' },
    { level: 'scholar', complexity: 'challenging words with less obvious etymological connections' },
    { level: 'magister', complexity: 'advanced vocabulary with obscure Latin roots' },
    { level: 'etymologus', complexity: 'highly sophisticated words with complex etymological origins' }
  ];

  // Generate all puzzles in parallel (much faster!)
  const puzzlePromises = difficulties.map(difficulty => 
    generatePuzzle(apiKey, difficulty)
  );
  
  const puzzles = await Promise.all(puzzlePromises);
  return puzzles;
}

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
}`;

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
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content.trim();
  
  // Parse the JSON response
  let puzzle;
  try {
    const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
    puzzle = JSON.parse(cleanContent);
  } catch (e) {
    console.error('Failed to parse GPT response:', content);
    throw new Error('Invalid JSON from GPT');
  }

  // Add difficulty metadata
  puzzle.difficulty = difficulty.level;
  puzzle.isSpeedRound = difficulty.level !== 'etymologus';
  puzzle.isFinalChallenge = difficulty.level === 'etymologus';

  return puzzle;
}

/**
 * Fallback puzzles if API fails
 */
function fallbackPuzzles() {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      date: new Date().toISOString().split('T')[0],
      generatedAt: new Date().toISOString(),
      puzzles: [
        {
          word: "TELESCOPE",
          clue: "Greek: tele, skopein",
          definition: "An optical instrument designed to make distant objects appear nearer.",
          briefEtymology: "From Greek tele (far) and skopein (to look)",
          detailedEtymology: "First coined in the early 1600s when Galileo improved upon the spyglass design. The word combines tele, meaning 'far off,' with skopein, 'to look at.' The telescope revolutionized astronomy by allowing humans to observe distant celestial objects.",
          difficulty: "novitiate",
          isSpeedRound: true,
          isFinalChallenge: false
        },
        {
          word: "DEMOCRACY",
          clue: "Greek: demos, kratos",
          definition: "A system of government by the whole population.",
          briefEtymology: "From Greek demos (people) and kratos (power)",
          detailedEtymology: "Originating in ancient Athens around 508 BCE, democracy literally means 'rule by the people.' The demos referred to the common people of Athens, while kratos signified strength or power.",
          difficulty: "disciple",
          isSpeedRound: true,
          isFinalChallenge: false
        },
        {
          word: "PHILANTHROPY",
          clue: "Greek: philos, anthropos",
          definition: "The desire to promote the welfare of others through generous donation.",
          briefEtymology: "From Greek philos (loving) and anthropos (human)",
          detailedEtymology: "Entering English in the 1600s, philanthropy literally translates to 'love of humanity.' The concept dates back to ancient Greek philosophy where philanthropia was considered a fundamental virtue.",
          difficulty: "scholar",
          isSpeedRound: true,
          isFinalChallenge: false
        },
        {
          word: "MAGNANIMOUS",
          clue: "Latin: magnus, animus",
          definition: "Generous or forgiving, showing nobility of spirit.",
          briefEtymology: "From Latin magnus (great) and animus (soul)",
          detailedEtymology: "This word entered English in the 1580s. It literally means 'great-souled' and was used in classical philosophy to describe the virtue of having a generous and noble disposition.",
          difficulty: "magister",
          isSpeedRound: true,
          isFinalChallenge: false
        },
        {
          word: "PERSPICACIOUS",
          clue: "Latin: per, spicere",
          definition: "Having a ready insight into things; acutely perceptive.",
          briefEtymology: "From Latin per (through) and spicere (to look)",
          detailedEtymology: "Dating from the 1610s, perspicacious derives from perspicax, the Latin word for 'sharp-sighted.' The prefix per- intensifies spicere (to look), suggesting the ability to see through appearances to underlying truths.",
          difficulty: "etymologus",
          isSpeedRound: false,
          isFinalChallenge: true
        }
      ]
    })
  };
}
