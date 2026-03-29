const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config({ path: '.env.local' });

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

async function main() {
  const models = ['claude-3-5-sonnet-latest', 'claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229'];
  for (const model of models) {
    try {
      console.log('Testing', model);
      const msg = await client.messages.create({
        model, max_tokens: 10, messages: [{role: 'user', content: 'hello'}]
      });
      console.log('Success:', model);
    } catch (e) {
      console.log('Failed:', model, e.message);
    }
  }
}
main();
