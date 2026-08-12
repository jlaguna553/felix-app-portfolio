-- 031: Pago pendiente (fiado)
-- Permite cerrar una cuenta sin cobrar y marcarla como pago pendiente para cobrarse después

ALTER TABLE public.tabs
  ADD COLUMN IF NOT EXISTS pending_payment boolean DEFAULT false;

-- Ampliar constraint de payment_source para incluir 'pendiente'
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_source_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_source_check
    CHECK (payment_source IN ('pos', 'caja', 'agent', 'pendiente'));
