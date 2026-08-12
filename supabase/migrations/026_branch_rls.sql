-- Migration 026: Branch-aware RLS policies
-- Users can only access their assigned branch's data.
-- Owner (is_owner()) sees all. Service role bypasses RLS entirely.

-- ── products ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all for authenticated" ON products;
DROP POLICY IF EXISTS "Authenticated users can manage products" ON products;

CREATE POLICY "branch isolation - products"
  ON products FOR ALL
  USING (is_owner() OR branch_id = get_user_branch_id());

-- ── categories ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all for authenticated" ON categories;
DROP POLICY IF EXISTS "Authenticated users can manage categories" ON categories;

CREATE POLICY "branch isolation - categories"
  ON categories FOR ALL
  USING (is_owner() OR branch_id = get_user_branch_id());

-- ── supplies ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all for authenticated" ON supplies;
DROP POLICY IF EXISTS "Authenticated users can manage supplies" ON supplies;

CREATE POLICY "branch isolation - supplies"
  ON supplies FOR ALL
  USING (is_owner() OR branch_id = get_user_branch_id());

-- ── tabs ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all for authenticated" ON tabs;
DROP POLICY IF EXISTS "Authenticated users can manage tabs" ON tabs;

CREATE POLICY "branch isolation - tabs"
  ON tabs FOR ALL
  USING (is_owner() OR branch_id = get_user_branch_id());

-- ── orders ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all for authenticated" ON orders;
DROP POLICY IF EXISTS "Authenticated users can manage orders" ON orders;

CREATE POLICY "branch isolation - orders"
  ON orders FOR ALL
  USING (is_owner() OR branch_id = get_user_branch_id());

-- ── shifts ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all for authenticated" ON shifts;
DROP POLICY IF EXISTS "Authenticated users can manage shifts" ON shifts;
DROP POLICY IF EXISTS "cashier or admin can manage shifts" ON shifts;

CREATE POLICY "branch isolation - shifts"
  ON shifts FOR ALL
  USING (is_owner() OR branch_id = get_user_branch_id());

-- ── promotions ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all for authenticated" ON promotions;
DROP POLICY IF EXISTS "Authenticated users can manage promotions" ON promotions;

CREATE POLICY "branch isolation - promotions"
  ON promotions FOR ALL
  USING (is_owner() OR branch_id = get_user_branch_id());

-- ── tables ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all for authenticated" ON tables;
DROP POLICY IF EXISTS "Authenticated users can manage tables" ON tables;
DROP POLICY IF EXISTS "admin and waiter can write tables" ON tables;

CREATE POLICY "branch isolation - tables"
  ON tables FOR ALL
  USING (is_owner() OR branch_id = get_user_branch_id());

-- ── floor_shapes ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all for authenticated" ON floor_shapes;
DROP POLICY IF EXISTS "Authenticated users can manage floor_shapes" ON floor_shapes;

CREATE POLICY "branch isolation - floor_shapes"
  ON floor_shapes FOR ALL
  USING (is_owner() OR branch_id = get_user_branch_id());

-- ── ai_conversations ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all for authenticated" ON ai_conversations;
DROP POLICY IF EXISTS "Users can manage their own conversations" ON ai_conversations;

CREATE POLICY "branch isolation - ai_conversations"
  ON ai_conversations FOR ALL
  USING (
    is_owner()
    OR (branch_id = get_user_branch_id() AND user_id = auth.uid())
  );
