-- Migration 025: Multi-branch support
-- Adds branches table, owner role, and branch_id to all operational tables

-- ── 1. BRANCHES TABLE ────────────────────────────────────────────────────────
CREATE TABLE branches (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text        NOT NULL,
  address              text,
  phone                text,
  business_name        text        NOT NULL DEFAULT '',
  business_type        text        NOT NULL DEFAULT '',
  business_description text        NOT NULL DEFAULT '',
  ai_business_context  text        NOT NULL DEFAULT '',
  ai_last_trained_at   timestamptz,
  is_active            boolean     NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- ── 2. is_owner() — does NOT reference profiles.branch_id, safe to create now ──
CREATE OR REPLACE FUNCTION is_owner()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'
  )
$$;

-- ── 3. ADD 'owner' ROLE ──────────────────────────────────────────────────────
ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('owner', 'admin', 'waiter', 'kitchen', 'cashier'));

-- ── 4. ADD branch_id TO profiles (nullable → owner has no branch) ────────────
-- Must happen BEFORE get_user_branch_id() is created
ALTER TABLE profiles
  ADD COLUMN branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;

-- ── 5. get_user_branch_id() — requires profiles.branch_id to exist ───────────
CREATE OR REPLACE FUNCTION get_user_branch_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT branch_id FROM profiles WHERE id = auth.uid()
$$;

-- ── 6. RLS FOR BRANCHES ──────────────────────────────────────────────────────
CREATE POLICY "owner manages all branches"
  ON branches FOR ALL
  USING (is_owner());

CREATE POLICY "users can view their own branch"
  ON branches FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND id = get_user_branch_id()
    AND is_active = true
  );

-- ── 7. DEFAULT BRANCH ────────────────────────────────────────────────────────
INSERT INTO branches (id, name, business_name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Principal', 'Gorditas Doña Félix');

-- Assign all existing users to the default branch
UPDATE profiles SET branch_id = '00000000-0000-0000-0000-000000000001';

-- ── 8. ADD branch_id TO ALL OPERATIONAL TABLES ──────────────────────────────
-- Fixed default assigns all existing rows to "Principal"

ALTER TABLE products
  ADD COLUMN branch_id uuid NOT NULL
  DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES branches(id) ON DELETE CASCADE;

ALTER TABLE categories
  ADD COLUMN branch_id uuid NOT NULL
  DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES branches(id) ON DELETE CASCADE;

ALTER TABLE supplies
  ADD COLUMN branch_id uuid NOT NULL
  DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES branches(id) ON DELETE CASCADE;

ALTER TABLE tabs
  ADD COLUMN branch_id uuid NOT NULL
  DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES branches(id) ON DELETE CASCADE;

ALTER TABLE orders
  ADD COLUMN branch_id uuid NOT NULL
  DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES branches(id) ON DELETE CASCADE;

ALTER TABLE shifts
  ADD COLUMN branch_id uuid NOT NULL
  DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES branches(id) ON DELETE CASCADE;

ALTER TABLE promotions
  ADD COLUMN branch_id uuid NOT NULL
  DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES branches(id) ON DELETE CASCADE;

ALTER TABLE tables
  ADD COLUMN branch_id uuid NOT NULL
  DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES branches(id) ON DELETE CASCADE;

ALTER TABLE floor_shapes
  ADD COLUMN branch_id uuid NOT NULL
  DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES branches(id) ON DELETE CASCADE;

ALTER TABLE ai_conversations
  ADD COLUMN branch_id uuid NOT NULL
  DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES branches(id) ON DELETE CASCADE;

-- ── 9. MIGRATE settings: copy business identity to default branch ─────────────
UPDATE branches
SET
  business_name        = COALESCE((SELECT value FROM settings WHERE key = 'business_name'),        ''),
  business_type        = COALESCE((SELECT value FROM settings WHERE key = 'business_type'),        ''),
  business_description = COALESCE((SELECT value FROM settings WHERE key = 'business_description'), ''),
  ai_business_context  = COALESCE((SELECT value FROM settings WHERE key = 'ai_business_context'),  ''),
  ai_last_trained_at   = (SELECT value::timestamptz FROM settings WHERE key = 'ai_last_trained_at')
WHERE id = '00000000-0000-0000-0000-000000000001';
