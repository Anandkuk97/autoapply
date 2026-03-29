const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config({ path: '.env.local' });

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

async function main() {
  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch(e) { console.log(e); }
}
main();
