import { GEMINI, DIALOGUE } from '../config.js';

let thinkingSupported = true;

function clean(text) {
  let t = text.replace(/[\r\n]+/g, ' ').replace(/^["'“”‘’\s*-]+|["'“”‘’\s]+$/g, '').replace(/\*+/g, '').trim();
  const words = t.split(/\s+/);
  if (words.length > DIALOGUE.MAX_WORDS + 4) t = words.slice(0, DIALOGUE.MAX_WORDS + 4).join(' ') + '…';
  return t.slice(0, 160);
}

/** One generateContent call. Throws on any failure so the caller can fall back to the mock. */
export async function generateLine({ apiKey, system, prompt, signal }) {
  const url = `${GEMINI.ENDPOINT}/${encodeURIComponent(GEMINI.MODEL)}:generateContent`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: GEMINI.TEMPERATURE,
      maxOutputTokens: GEMINI.MAX_OUTPUT_TOKENS,
      ...(thinkingSupported && GEMINI.THINKING_LEVEL ? { thinkingConfig: { thinkingLevel: GEMINI.THINKING_LEVEL } } : {}),
    },
  };
  const send = () => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
    signal,
  });
  let res = await send();
  if (res.status === 400 && body.generationConfig.thinkingConfig && /thinking/i.test(await res.clone().text())) {
    // This model rejects thinkingConfig; drop it for the rest of the session.
    thinkingSupported = false;
    delete body.generationConfig.thinkingConfig;
    res = await send();
  }
  if (!res.ok) {
    const err = new Error(`Gemini HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  const parts = json.candidates?.[0]?.content?.parts || [];
  const text = parts.filter((p) => !p.thought && p.text).map((p) => p.text).join(' ').trim();
  if (!text) throw new Error(`Gemini returned no text (${json.candidates?.[0]?.finishReason || 'unknown'})`);
  return clean(text);
}
