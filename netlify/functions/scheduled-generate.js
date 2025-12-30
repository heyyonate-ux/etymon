const generateDailyPuzzle = require('./generate-daily-puzzle');

/**
 * Netlify Scheduled Function
 * Runs automatically every day at midnight UTC
 * Generates new daily puzzles using the generate-daily-puzzle function
 */
exports.handler = async (event, context) => {
  console.log('Scheduled function triggered at:', new Date().toISOString());
  
  // Call the puzzle generation function
  const result = await generateDailyPuzzle.handler(event, context);
  
  console.log('Scheduled generation result:', result);
  
  return result;
};
