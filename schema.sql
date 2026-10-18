-- Caudal · esquema de la base de datos D1
-- (La app lo crea sola en la primera petición; este archivo es solo de referencia.)
CREATE TABLE IF NOT EXISTS records (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,             -- account | category | tx | rule | budget | settings
  data       TEXT NOT NULL,             -- JSON del registro
  updated_at INTEGER NOT NULL,          -- ms (reloj del dispositivo que lo editó)
  deleted    INTEGER NOT NULL DEFAULT 0,
  rev        INTEGER NOT NULL           -- ms del servidor al guardar (para sincronizar)
);
CREATE INDEX IF NOT EXISTS idx_records_rev ON records(rev);
