-- Sample TARGET database — deterministic seed.
-- Every value derives from generate_series + modular arithmetic (no random()),
-- so a fresh volume always produces byte-identical data: integration tests and
-- manual QA can assert exact counts and rows. Identity columns start at 1 on a
-- fresh init, which is what the FK arithmetic below relies on.

-- ~50 customers, sign-ups spread over Jan–Jun 2024, 10 countries round-robin.
INSERT INTO customers (email, country, created_at)
SELECT
  format('customer%s@example.com', gs),
  (ARRAY['FR', 'DE', 'US', 'GB', 'ES', 'IT', 'NL', 'BE', 'CA', 'JP'])[(gs % 10) + 1],
  timestamptz '2024-01-02 08:00:00+00' + (gs - 1) * interval '3 days 5 hours'
FROM generate_series(1, 50) AS gs;

-- ~30 products: 6 lines x 5 categories = 30 unique names; prices/stock vary
-- through coprime multipliers so no two look alike but all are reproducible.
INSERT INTO products (name, price_cents, stock)
SELECT
  format(
    '%s %s',
    (ARRAY['Aurora', 'Basalt', 'Cedar', 'Drift', 'Ember', 'Fjord'])[((gs - 1) % 6) + 1],
    (ARRAY['Mug', 'Lamp', 'Chair', 'Desk', 'Backpack'])[((gs - 1) / 6) + 1]
  ),
  500 + (gs * 1371) % 19500,
  (gs * 7) % 120
FROM generate_series(1, 30) AS gs;

-- ~200 orders, placed Jul 2024 → Feb 2025 (always after the last customer
-- sign-up), weighted statuses (delivered most common, cancelled rare),
-- customers revisited via a 17-step walk (17 is coprime with 50: all 50 hit).
INSERT INTO orders (customer_id, status, placed_at)
SELECT
  ((gs * 17) % 50) + 1,
  -- Cast to the enum type: the CASE resolves to text, and Postgres will not
  -- implicitly coerce text into the order_status enum column.
  (CASE
    WHEN gs % 20 < 2  THEN 'pending'
    WHEN gs % 20 < 7  THEN 'paid'
    WHEN gs % 20 < 11 THEN 'shipped'
    WHEN gs % 20 < 18 THEN 'delivered'
    ELSE 'cancelled'
  END)::order_status,
  timestamptz '2024-07-01 09:00:00+00' + (gs - 1) * interval '27 hours 30 minutes'
FROM generate_series(1, 200) AS gs;

-- 1–3 items per order (~400 rows). Product picked by an 11-step walk so the
-- (order_id, product_id) PK never collides within an order (11 and 22 are not
-- multiples of 30); unit price snapshots the product's current price.
INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents)
SELECT
  o.gs,
  p.id,
  ((o.gs + item.n) % 4) + 1,
  p.price_cents
FROM generate_series(1, 200) AS o (gs)
CROSS JOIN LATERAL generate_series(1, (o.gs % 3) + 1) AS item (n)
JOIN products p ON p.id = ((o.gs * 7 + item.n * 11) % 30) + 1;
