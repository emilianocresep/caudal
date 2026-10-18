// Worker de Caudal: sirve la app (carpeta dist) y la API /api/*.
import { checkAccess } from '../server/auth.js';
import { handleSync } from '../server/sync.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const denied = await checkAccess(request, env);
      if (denied) return denied;
      if (url.pathname === '/api/sync' && request.method === 'POST') {
        try { return await handleSync(request, env); }
        catch (e) { return json({ error: 'server', message: e.message || 'Error interno' }, 500); }
      }
      if (url.pathname === '/api/health') return json({ ok: true, app: 'caudal', db: !!env.DB });
      return json({ error: 'not_found' }, 404);
    }
    return env.ASSETS.fetch(request);
  },
};
