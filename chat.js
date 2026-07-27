// api/chat.js
// Serverless function (Vercel format) that keeps your Anthropic API key on the
// server, never in the browser. Deploy this file inside an /api folder at the
// root of a Vercel project and it becomes available at /api/chat automatically.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY' });
  }

  const { system, messages } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  // Basic guardrails: cap history length and message size so one visitor
  // can't run up a huge bill in a single request.
  const trimmedMessages = messages.slice(-20).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 2000)
  }));

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        system: system || 'You are a helpful shopping assistant.',
        messages: trimmedMessages
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', response.status, errText);
      return res.status(502).json({ error: 'Assistant is temporarily unavailable' });
    }

    const data = await response.json();
    const reply = (data.content || [])
      .map(block => block.text || '')
      .join('\n')
      .trim();

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('Chat proxy error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}
