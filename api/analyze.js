export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check API key exists
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'API key not configured on server.' });
  }

  let body = req.body;

  // Parse body if it's a string
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {
      return res.status(400).json({ error: 'Invalid request body.' });
    }
  }

  const { answers } = body || {};

  if (!answers || !Array.isArray(answers) || answers.length !== 5) {
    return res.status(400).json({ error: 'Please provide all 5 answers.' });
  }

  const [frustration, gift, energy, soil, seed] = answers;

  const userMessage = `
Here are my five answers for the Purpose Discovery assessment:

1. THE FRUSTRATION – What consistently bothers me:
${frustration}

2. THE GIFT – My natural built-in abilities:
${gift}

3. THE ENERGY – What gives me energy:
${energy}

4. THE SOIL – Environments where I thrive:
${soil}

5. THE SEED – What I was drawn to before responsibilities:
${seed}

Please analyse these through the purpose discovery framework and produce my Blueprint report.
  `.trim();

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 1500,
        system: `You are a warm, insightful purpose discovery mentor. Use simple, everyday English.
Your role is to help people uncover their life assignment and innate equipment.
Framework: frustration = life assignment; gifts = innate equipment.
Do NOT just summarise answers. Give a real positioning strategy and immediate next steps.
Return ONLY a raw JSON object — absolutely no markdown, no backticks, no explanation, just the JSON:
{
  "coreIdentity": "2-3 profound sentences about who they are at their core.",
  "lifeAssignment": "2-3 sentences about the specific problem they were built to solve.",
  "positioningStrategy": "3-4 sentences of concrete actionable advice for right now.",
  "nextSteps": ["Step 1", "Step 2", "Step 3", "Step 4", "Step 5"]
}`,
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic error:', response.status, errText);
      return res.status(500).json({ error: `AI service returned error ${response.status}` });
    }

    const data = await response.json();
    const raw = data.content.map(b => b.text || '').join('').trim();

    // Strip any accidental markdown fences
    const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

    let result;
    try {
      result = JSON.parse(clean);
    } catch (parseErr) {
      console.error('JSON parse failed. Raw output:', clean);
      return res.status(500).json({ error: 'Could not parse AI response. Please try again.' });
    }

    return res.status(200).json(result);

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
}
