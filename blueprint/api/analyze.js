export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { answers } = req.body;

  if (!answers || !Array.isArray(answers) || answers.length !== 5) {
    return res.status(400).json({ error: 'Invalid answers format' });
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
        system: `You are a warm, insightful purpose discovery mentor. Use simple, everyday English — not corporate jargon.
Your role is to help people uncover their life assignment and innate equipment.
Framework: frustration = life assignment; gifts = innate equipment.
Do NOT just summarise answers. Give a real positioning strategy and immediate next steps.
Return ONLY a JSON object — no markdown, no extra text — with this exact structure:
{
  "coreIdentity": "2-3 profound sentences about who they are at their core and how they are uniquely designed.",
  "lifeAssignment": "2-3 sentences about the specific problem they were built to solve in the world.",
  "positioningStrategy": "3-4 sentences of concrete, actionable advice they can use right now.",
  "nextSteps": ["Step 1 with clear action", "Step 2 with clear action", "Step 3 with clear action", "Step 4 with clear action", "Step 5 with clear action"]
}`,
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', errText);
      return res.status(500).json({ error: 'AI service error. Please try again.' });
    }

    const data = await response.json();
    const raw = data.content.map(b => b.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();

    let result;
    try {
      result = JSON.parse(clean);
    } catch (parseErr) {
      console.error('JSON parse error:', clean);
      return res.status(500).json({ error: 'Could not parse AI response.' });
    }

    return res.status(200).json(result);

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
