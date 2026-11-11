CREATE UNIQUE INDEX IF NOT EXISTS one_unresolved_payment_operation ON payment_operations(payment_id) WHERE status IN ('running','uncertain');
