// Sincronización: el dispositivo manda sus cambios y recibe los del servidor.
// Estrategia "last-write-wins": gana la versión editada más recientemente (updated_at).

const KINDS = new Set(['account', 'category', 'tx', 'rule', 'budget', 'settings']);
const MAX_CHANGES = 500;
const MAX_DATA = 32 * 1024;
const OVERLAP_MS = 5000; // margen para no perder cambios escritos en el mismo instante

let schemaReady = false;
async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL, data TEXT NOT NULL,
      updated_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, rev INTEGER NOT NULL)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_records_rev ON records(rev)`),
  ]);
  schemaReady = true;
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

function validate(c) {
  if (!c || typeof c !== 'object') return 'cambio inválido';
  if (typeof c.id !== 'string' || c.id.length < 1 || c.id.length > 80) return 'id inválido';
  if (!KINDS.has(c.kind)) return 'tipo inválido';
  if (!Number.isFinite(c.updated_at)) return 'updated_at inválido';
  const data = typeof c.data === 'string' ? c.data : JSON.stringify(c.data ?? {});
  if (data.length > MAX_DATA) return 'registro demasiado grande';
  return null;
}

export async function handleSync(request, env) {
  if (!env.DB) return json({ error: 'config', message: 'Falta el enlace D1 llamado DB.' }, 500);
  const db = env.DB;
  await ensureSchema(db);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad_request' }, 400); }

  const since = Number.isFinite(body.since) ? body.since : 0;
  const changes = Array.isArray(body.changes) ? body.changes : [];
  if (changes.length > MAX_CHANGES) return json({ error: 'too_many', max: MAX_CHANGES }, 413);

  for (const c of changes) {
    const err = validate(c);
    if (err) return json({ error: 'bad_request', message: err, id: c?.id }, 400);
  }

  const rev = Date.now();
  if (changes.length) {
    const stmt = db.prepare(`
      INSERT INTO records (id, kind, data, updated_at, deleted, rev)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6)
      ON CONFLICT(id) DO UPDATE SET
        kind = excluded.kind, data = excluded.data, updated_at = excluded.updated_at,
        deleted = excluded.deleted, rev = excluded.rev
      WHERE excluded.updated_at > records.updated_at`);
    await db.batch(
      changes.map((c) =>
        stmt.bind(
          c.id, c.kind,
          typeof c.data === 'string' ? c.data : JSON.stringify(c.data ?? {}),
          Math.round(c.updated_at), c.deleted ? 1 : 0, rev
        )
      )
    );
  }

  const PAGE = 2000;
  const cur = body.cursor && Number.isFinite(body.cursor.rev) && typeof body.cursor.id === 'string' ? body.cursor : null;
  const q = cur
    ? db.prepare(`SELECT id, kind, data, updated_at, deleted, rev FROM records
        WHERE rev > ?1 OR (rev = ?1 AND id > ?2) ORDER BY rev, id LIMIT ${PAGE}`).bind(cur.rev, cur.id)
    : db.prepare(`SELECT id, kind, data, updated_at, deleted, rev FROM records
        WHERE rev > ?1 ORDER BY rev, id LIMIT ${PAGE}`).bind(since > 0 ? since - OVERLAP_MS : 0);
  const { results } = await q.all();

  const rows = results.map((r) => ({
    id: r.id, kind: r.kind, data: JSON.parse(r.data),
    updated_at: r.updated_at, deleted: !!r.deleted,
  }));
  const more = results.length === PAGE;
  const last = results[results.length - 1];
  return json({
    rows,
    rev: results.reduce((m, r) => Math.max(m, r.rev), rev),
    more,
    cursor: more ? { rev: last.rev, id: last.id } : null,
  });
}

