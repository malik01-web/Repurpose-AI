export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { article, apiKey, tone = 'casual', language = 'English' } = req.body;

  if (!article || !apiKey) {
    return res.status(400).json({ error: 'Missing article or API key' });
  }

  const toneGuide = {
    casual: 'Write in a friendly, conversational, relatable tone. Use simple words and feel free to use emojis.',
    professional: 'Write in a polished, authoritative, business-appropriate tone. No slang, no emojis.',
    funny: 'Write in a witty, humorous tone. Use clever wordplay and fun analogies.',
  };

  const prompt = `You are a content repurposing expert.
TONE: ${toneGuide[tone] || toneGuide.casual}
OUTPUT LANGUAGE: Write everything in ${language}.

ARTICLE:
${article}

Return ONLY a valid JSON object, no markdown, no backticks:
{"twitter":"Twitter thread with hook + 4-6 numbered tweets + CTA","linkedin":"LinkedIn post 150-250 words with hook and CTA","email":"Email with Subject: on first line then 100-150 word body","instagram":"Instagram caption with punchy opener and 5-8 hashtags"}`;

  const MODELS = [
    'meta-llama/llama-3.1-8b-instruct:free',
    'mistralai/mistral-7b-instruct:free',
    'google/gemma-2-9b-it:free',
  ];

  async function callModel(model) {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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

    if (!r.ok) {
      const err = await r.json();
      throw new Error(err.error?.message || `${model} failed`);
    }

    const data = await r.json();
    const content = data.choices[0].message.content.trim();
    try {
      return JSON.parse(content);
    } catch {
      return JSON.parse(content.replace(/```json|```/g, '').trim());
    }
  }

  let parsed, lastError;
  for (const model of MODELS) {
    try { parsed = await callModel(model); break; }
    catch (err) { lastError = err; }
  }

  if (!parsed) return res.status(500).json({ error: lastError?.message || 'All models failed.' });
  return res.status(200).json(parsed);
}
