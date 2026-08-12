-- Migration 027: Venta de mostrador + atribución a agente IA
-- Añade type='mostrador' a tabs y columna source='pos'|'agent'.

-- ── tabs.type: añadir 'mostrador' ────────────────────────────────────────────
ALTER TABLE tabs DROP CONSTRAINT IF EXISTS tabs_type_check;
ALTER TABLE tabs ADD CONSTRAINT tabs_type_check
  CHECK (type IN ('table', 'client', 'mostrador'));

-- ── tabs.source: quién originó la tab (usuario vs agente IA) ─────────────────
ALTER TABLE tabs ADD COLUMN IF NOT EXISTS source text
  NOT NULL DEFAULT 'pos'
  CHECK (source IN ('pos', 'agent'));
