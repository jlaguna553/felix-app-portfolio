-- 030: Menu Builder
-- Tablas para el editor de menú visual con elementos arrastrables

CREATE TABLE menus (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id    uuid REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
  name         text NOT NULL DEFAULT 'Mi Menú',
  bg_color     text NOT NULL DEFAULT '#FFFFFF',
  bg_image_url text,
  created_at   timestamptz DEFAULT now() NOT NULL,
  updated_at   timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE menu_elements (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_id    uuid REFERENCES menus(id) ON DELETE CASCADE NOT NULL,
  type       text NOT NULL CHECK (type IN ('product', 'text', 'image', 'line', 'shape')),
  x          integer NOT NULL DEFAULT 0,
  y          integer NOT NULL DEFAULT 0,
  width      integer NOT NULL DEFAULT 200,
  height     integer NOT NULL DEFAULT 80,
  z_index    integer NOT NULL DEFAULT 0,
  config     jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE menus          ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_elements  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menus_branch_isolation" ON menus
  FOR ALL USING (is_owner() OR branch_id = get_user_branch_id());

CREATE POLICY "menu_elements_branch_isolation" ON menu_elements
  FOR ALL USING (
    menu_id IN (
      SELECT id FROM menus
      WHERE is_owner() OR branch_id = get_user_branch_id()
    )
  );
