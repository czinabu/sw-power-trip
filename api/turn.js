// Vercel serverless function: mints short-lived Cloudflare TURN relay credentials for online co-op, so the secret key
// never reaches the browser. Needs two environment variables on the Vercel project:
//   CF_TURN_KEY_ID      the TURN key's id        CF_TURN_API_TOKEN   the key's API token
// Without them it answers 503 and the game falls back to plain STUN (still fine on most home networks).

export default async function handler(req, res){
  const id = process.env.CF_TURN_KEY_ID, token = process.env.CF_TURN_API_TOKEN;
  if (!id || !token){ res.status(503).json({ error: 'TURN is not configured' }); return; }
  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${id}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: 3 * 3600 }),   // a session lasts an hour or two
    });
    if (!r.ok){ res.status(502).json({ error: 'TURN provider refused' }); return; }
    const { iceServers } = await r.json();
    // port 53 is blocked by browsers and makes ICE wait for a timeout
    const clean = (iceServers || []).map(s => ({ ...s, urls: [].concat(s.urls).filter(u => !/:53(\?|$)/.test(u)) }));
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ iceServers: clean });
  } catch(e){ res.status(502).json({ error: 'TURN request failed' }); }
}
