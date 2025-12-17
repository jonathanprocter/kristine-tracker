import http from 'http';

// First login
const loginReq = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/trpc/auth.simpleLogin',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  let data = '';
  const cookies = res.headers['set-cookie'];
  console.log('Login cookies:', cookies);
  
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Login response:', data);
    
    // Now call TTS with the cookie
    if (cookies && cookies.length > 0) {
      const sessionCookie = cookies[0].split(';')[0];
      console.log('Using cookie:', sessionCookie);
      
      const ttsReq = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/trpc/ai.textToSpeech',
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': sessionCookie
        }
      }, (ttsRes) => {
        let ttsData = '';
        ttsRes.on('data', chunk => ttsData += chunk);
        ttsRes.on('end', () => {
          console.log('TTS response:', ttsData);
        });
      });
      
      ttsReq.write(JSON.stringify({ json: { text: 'Hello test' } }));
      ttsReq.end();
    }
  });
});

loginReq.write(JSON.stringify({ json: { credential: 'kristine' } }));
loginReq.end();
