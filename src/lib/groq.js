import Groq from 'groq-sdk';

let _client = null;

export function getGroqClient(apiKey) {
  if (!apiKey) return null;
  if (!_client) {
    _client = new Groq({ apiKey, dangerouslyAllowBrowser: true });
  }
  return _client;
}

export function resetGroqClient() {
  _client = null;
}

/**
 * Given a search query and list of notes, returns IDs of semantically relevant notes.
 * Uses llama3-70b to understand meaning even when exact words don't match.
 */
export async function semanticSearch(query, notes, apiKey) {
  if (!apiKey) throw new Error('No Groq API key set');
  if (!notes || notes.length === 0) return [];

  const client = getGroqClient(apiKey);

  const notesList = notes
    .map((n) => `ID: ${n.id}\nTitle: ${n.title}\nBody: ${n.body}`)
    .join('\n\n---\n\n');

  const prompt = `You are a smart note search assistant. Given a search query and a list of notes, return the IDs of notes that are relevant to the query. Use semantic understanding - for example, "flight" should match notes about airlines, airports, tickets, SpiceJet, IndiGo, vouchers for airlines, etc.

Search query: "${query}"

Notes:
${notesList}

Return ONLY a JSON array of matching note IDs, nothing else. Example: ["id1", "id2"]
If no notes match, return an empty array: []`;

  const response = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens: 200,
  });

  const content = response.choices[0]?.message?.content?.trim() || '[]';

  try {
    const jsonMatch = content.match(/\[.*\]/s);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Parses a plain-text natural language input and returns structured data.
 * Detects whether it's a note or a reminder, extracts title, body, datetime etc.
 *
 * Returns:
 *   { type: "note", title: string, body: string }
 *   { type: "reminder", title: string, datetime: string (ISO), note: string }
 */
export async function parseNaturalInput(text, apiKey) {
  if (!apiKey) throw new Error('No Groq API key set');

  const client = getGroqClient(apiKey);

  const now = new Date();
  const currentDateStr = now.toLocaleString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  const prompt = `You are a smart personal assistant that extracts structured data from plain-text input.

Current date and time: ${currentDateStr}
Current ISO datetime: ${now.toISOString()}

Analyze the following input and decide:
- If it sounds like something that needs to happen at a specific future time (appointment, task, deadline, reminder) → type "reminder"
- If it is information to store for later reference (voucher, code, password, fact, note) → type "note"

Input: "${text}"

Return ONLY a single valid JSON object with no extra text, explanation, or markdown. Use one of these exact shapes:

For a note:
{"type":"note","title":"Short descriptive title (max 60 chars)","body":"Full information to save, well formatted"}

For a reminder:
{"type":"reminder","title":"Short action title (max 60 chars)","datetime":"ISO 8601 datetime string resolved from current date","note":"Optional extra context, empty string if none"}

Rules:
- Resolve relative dates (tomorrow, next Friday, in 2 hours) using the current datetime provided above
- Title should be clean and concise (no filler words like "remind me to")
- Body/note should preserve all useful details from the input
- If time is not specified for a reminder, default to 09:00 of that day`;

  const response = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens: 300,
  });

  const content = response.choices[0]?.message?.content?.trim() || '{}';

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.type === 'note' || parsed.type === 'reminder') {
        return parsed;
      }
    }
    throw new Error('Unexpected response format');
  } catch {
    // Fallback: treat as a plain note
    return { type: 'note', title: text.slice(0, 60), body: text };
  }
}
