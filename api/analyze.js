module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ 
      error: "API key not set. Key names found: " + Object.keys(process.env).filter(k => k.includes("KEY") || k.includes("API")).join(", ")
    });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } 
    catch (e) { return res.status(400).json({ error: "Invalid request body." }); }
  }

  const { answers } = body || {};

  if (!answers || !Array.isArray(answers) || answers.length !== 5) {
    return res.status(400).json({ error: "Need exactly 5 answers." });
  }

  const prompt = `You are a purpose discovery mentor. Use simple everyday English.
Framework: frustration = life assignment, gifts = innate equipment.
Do not just summarise. Give real positioning strategy and next steps.
Return ONLY raw JSON with no markdown, no backticks, no extra text whatsoever.

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
        generationConfig: { temperature: 0.7, maxOutputTokens: 1200 }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: "Gemini API error " + response.status + ": " + errText });
    }

    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

    let result;
    try {
      result = JSON.parse(clean);
    } catch (e) {
      return res.status(500).json({ error: "Could not parse AI response: " + clean.substring(0, 120) });
    }

    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: "Server error: " + err.message });
  }
};
