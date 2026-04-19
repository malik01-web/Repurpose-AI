export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { article, apiKey } = req.body;

  if (!article || !apiKey) {
    return res.status(400).json({ error: 'Missing article or API key' });
  }

  const prompt = `You are a professional content repurposing expert. Take the following article and rewrite it into 4 distinct content formats. Be specific, engaging, and platform-native for each format.

ARTICLE:
${article}

Return ONLY a valid JSON object in this exact format (no markdown, no backticks):
{
  "twitter": "A Twitter/X thread. Start with a hook tweet, then 4-6 numbered tweets (1/, 2/, etc.), end with a CTA. Use line breaks between tweets.",
  "linkedin": "A LinkedIn post. Professional tone, 150-250 words, with a story hook, key insight, and CTA. Use line breaks for readability.",
  "email": "An email newsletter snippet. Subject line on first line starting with 'Subject:', then the body (100-150 words). Conversational but valuable.",
  "instagram": "An Instagram caption. Punchy opener, 3-5 lines, 5-8 relevant hashtags at the end."
}`;

  const MODELS = [
    'meta-llama/llama-4-maverick:free',
    'qwen/qwen3-30b-a3b:free',
    'google/gemma-3-27b-it:free',
  ];

  async function callModel(model) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://repurpose-ai-bmki.vercel.app',
        'X-Title': 'RepurposeAI',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `Model ${model} failed`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();

    try {
      return JSON.parse(content);
    } catch {
      const clean = content.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    }
  }

  let parsed;
  let lastError;

  for (const model of MODELS) {
    try {
      parsed = await callModel(model);
      break;
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  if (!parsed) {
    return res.status(500).json({ error: lastError?.message || 'All models failed. Try again.' });
  }

  return res.status(200).json(parsed);
}
