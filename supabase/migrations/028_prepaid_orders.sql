-- Migration 028: Pedidos prepagados (mostrador / para llevar)
-- El campo prepaid=true indica que el pago fue cobrado al momento de ordenar.
-- El pedido pasa por la cocina (pending→preparing→ready→paid) pero el dinero
-- ya está registrado desde la creación.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS prepaid boolean NOT NULL DEFAULT false;
