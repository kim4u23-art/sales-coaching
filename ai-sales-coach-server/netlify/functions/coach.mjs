// Gemini 프록시: API 키는 Netlify 환경변수에만 저장됩니다.
const sleep = ms => new Promise(r => setTimeout(r, ms));
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST만 허용됩니다.' }, 405);
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ error: '서버에 GEMINI_API_KEY가 설정되지 않았습니다.' }, 500);
  let b;
  try { b = await req.json(); } catch { return json({ error: '잘못된 요청입니다.' }, 400); }
  const pass = process.env.APP_PASSCODE;
  if (pass && b.passcode !== pass) return json({ error: '접속 코드가 올바르지 않습니다.' }, 401);
  if (!b.prompt || String(b.prompt).length > 8000) return json({ error: '요청 내용이 비었거나 너무 깁니다.' }, 400);

  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: String(b.system || '').slice(0, 2000) }] },
    contents: [{ role: 'user', parts: [{ text: String(b.prompt) }] }],
    generationConfig: { temperature: 0.8, responseMimeType: 'application/json' }
  });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  for (let n = 0; n < 3; n++) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      const text = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
      return json({ text });
    }
    if (r.status === 503 && n < 2) { await sleep(2000 * (n + 1)); continue; }
    return json({ error: j.error?.message || 'HTTP ' + r.status }, r.status);
  }
};

export const config = { path: '/api/coach' };
