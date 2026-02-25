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

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Gemini API key not set in Vercel environment variables." }), { status: 500, headers });
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

  const prompt = `You are a purpose discovery mentor. Use simple everyday English.
Framework: frustration = life assignment, gifts = innate equipment.
Do not just summarise. Give real positioning strategy and next steps.
Return ONLY raw JSON with no markdown, no backticks, no extra text whatsoever. Just the JSON object.

Here are the five answers:
Frustration: ${answers[0]}
Gift: ${answers[1]}
Energy: ${answers[2]}
Soil: ${answers[3]}
Seed: ${answers[4]}

Return exactly this JSON structure:
{"coreIdentity":"2-3 profound sentences about who they are at their core","lifeAssignment":"2-3 sentences about the specific problem they were built to solve","positioningStrategy":"3-4 sentences of concrete actionable advice for right now","nextSteps":["step 1","step 2","step 3","step 4","step 5"]}`;

  try {
    const geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + apiKey;

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1200
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: "Gemini API error " + response.status + ": " + errText }), { status: 500, headers });
    }

    const data = await response.json();

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

    let result;
    try {
      result = JSON.parse(clean);
    } catch (e) {
      return new Response(JSON.stringify({ error: "Could not parse AI response: " + clean.substring(0, 120) }), { status: 500, headers });
    }

    return new Response(JSON.stringify(result), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Server error: " + err.message }), { status: 500, headers });
  }
}
