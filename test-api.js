// Test script per verificare OpenAI API
require('dotenv').config({ path: '.env.local' });
const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function testAPI() {
  try {
    console.log('🧪 Testando OpenAI API...');
    
    const response = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "Sei un assistente utile." },
        { role: "user", content: "Dimmi 'Ciao' in italiano" }
      ],
      max_tokens: 50
    });

    console.log('✅ API funziona!');
    console.log('Risposta:', response.choices[0].message.content);
    console.log('Token utilizzati:', response.usage);
    
  } catch (error) {
    console.error('❌ Errore API:', error.message);
    console.log('\n🔧 Controlla:');
    console.log('1. Chiave API corretta in .env.local');
    console.log('2. Credito disponibile su OpenAI');
    console.log('3. Connessione internet');
  }
}

testAPI();
