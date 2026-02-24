export const config = { runtime: "edge" };

export default async function handler(req) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API key not set in Vercel environment variables." }), { status: 500, headers });
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid request body." }), { status: 400, headers });
  }

  const { answers } = body || {};

  if (!answers || !Array.isArray(answers) || answers.length !== 5) {
    return new Response(JSON.stringify({ error: "Need exactly 5 answers." }), { status: 400, headers });
  }

  const prompt = `Frustration: ${answers[0]}\nGift: ${answers[1]}\nEnergy: ${answers[2]}\nSoil: ${answers[3]}\nSeed: ${answers[4]}`;

  const systemPrompt = `You are a purpose discovery mentor. Use simple everyday English.
Framework: frustration = life assignment, gifts = innate equipment.
Do not summarise. Give real positioning strategy and next steps.
Return ONLY this exact JSON structure with no markdown, no backticks, no extra text:
{"coreIdentity":"write 2-3 sentences here","lifeAssignment":"write 2-3 sentences here","positioningStrategy":"write 3-4 sentences here","nextSteps":["step 1","step 2","step 3","step 4","step 5"]}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1200,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: "Anthropic API error " + response.status + ": " + errText }), { status: 500, headers });
    }

    const data = await response.json();
    const raw = data.content.map(b => b.text || "").join("").trim();
    const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

    let result;
    try {
      result = JSON.parse(clean);
    } catch (e) {
      return new Response(JSON.stringify({ error: "Could not parse AI response: " + clean.substring(0, 100) }), { status: 500, headers });
    }

    return new Response(JSON.stringify(result), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Server error: " + err.message }), { status: 500, headers });
  }
}
