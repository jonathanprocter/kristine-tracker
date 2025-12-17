import { ElevenLabsClient } from 'elevenlabs';

async function test() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  console.log('API Key length:', apiKey?.length || 0);
  console.log('API Key starts with:', apiKey?.substring(0, 5) || 'N/A');
  
  if (!apiKey) {
    console.log('No API key found');
    return;
  }
  
  const client = new ElevenLabsClient({
    apiKey: apiKey,
  });
  
  console.log('Testing TTS...');
  const audioStream = await client.textToSpeech.convert('EXAVITQu4vr4xnSDxMaL', {
    text: 'Hello test',
    model_id: 'eleven_multilingual_v2',
  });
  
  let size = 0;
  for await (const chunk of audioStream) {
    size += chunk.length;
  }
  console.log('Success! Audio size:', size, 'bytes');
}

test().catch(e => console.error('Error:', e.message));
