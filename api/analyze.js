
const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key missing on server.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); }
    catch (e) { return res.status(400).json({ error: 'Invalid request body.' }); }
  }

  const { answers } = body || {};
  if (!answers || !Array.isArray(answers) || answers.length !== 5) {
    return res.status(400).json({ error: 'Need exactly 5 answers.' });
  }

  const payload = JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    system: 'You are a purpose discovery mentor. Use simple everyday English. Framework: frustration = life assignment, gifts = innate equipment. Do not just summarise. Give real positioning strategy and next steps. Return ONLY raw JSON, no markdown, no backticks: {"coreIdentity":"...","lifeAssignment":"...","positioningStrategy":"...","nextSteps":["...","...","...","...","..."]}',
    messages: [{ role: 'user', content: 'Frustration: ' + answers[0] + ' Gift: ' + answers[1] + ' Energy: ' + answers[2] + ' Soil: ' + answers[3] + ' Seed: ' + answers[4] }]
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const apiReq = https.request(options, (apiRes) => {
      let data = '';
      apiRes.on('data', chunk => data += chunk);
      apiRes.on('end', () => {
        try {
          if (apiRes.statusCode !== 200) {
            res.status(500).json({ error: 'Anthropic error ' + apiRes.statusCode + ': ' + data });
            return resolve();
          }
          const parsed = JSON.parse(data);
          const raw = parsed.content.map(function(b) { return b.text || ''; }).join('').trim();
          const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
          const result = JSON.parse(clean);
          res.status(200).json(result);
          resolve();
        } catch (err) {
          res.status(500).json({ error: 'Parse error: ' + err.message });
          resolve();
        }
      });
    });

    apiReq.on('error', function(err) {
      res.status(500).json({ error: 'Network error: ' + err.message });
      resolve();
    });

    apiReq.write(payload);
    apiReq.end();
  });
};
