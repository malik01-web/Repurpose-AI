export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { article, apiKey, tone = 'casual', language = 'English' } = req.body;

  if (!article || !apiKey) {
    return res.status(400).json({ error: 'Missing article or API key. Please add your OpenRouter key via the ⚙ button.' });
  }

  const toneGuide = {
    casual: 'Friendly, conversational tone. Simple words, feel free to use emojis.',
    professional: 'Polished, authoritative, business tone. No slang, no emojis.',
    funny: 'Witty, humorous tone. Clever wordplay and fun analogies.',
  };

  const prompt = `You are a content repurposing expert.
TONE: ${toneGuide[tone] || toneGuide.casual}
OUTPUT LANGUAGE: Write everything in ${language}.

ARTICLE:
${article}

Return ONLY a raw JSON object with no markdown formatting or backticks:
{"twitter":"Twitter thread: hook tweet + 4-5 numbered tweets (1/ 2/ etc) + CTA tweet","linkedin":"LinkedIn post 150-200 words with story hook and CTA","email":"Subject: [subject line here]\\n\\n[100-150 word email body]","instagram":"Punchy caption 3-4 lines + 6 hashtags"}`;

  const MODELS = [
    'meta-llama/llama-3.2-3b-instruct:free',
    'meta-llama/llama-3.1-8b-instruct:free',
    'mistralai/mistral-7b-instruct:free',
    'qwen/qwen-2-7b-instruct:free',
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
      const clean = content.replace(/```json|```/g, '').trim();
      const start = clean.indexOf('{');
      const end = clean.lastIndexOf('}');
      return JSON.parse(clean.slice(start, end + 1));
    }
  }

  let parsed, lastError;
  for (const model of MODELS) {
    try { parsed = await callModel(model); break; }
    catch (err) { lastError = err; }
  }

  if (!parsed) return res.status(500).json({ error: lastError?.message || 'All models failed. Check your OpenRouter API key.' });
  return res.status(200).json(parsed);
}
