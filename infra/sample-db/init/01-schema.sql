-- Sample TARGET database — schema.
-- A small but realistic e-commerce model, so the explorer and the connection
-- guardrails are developed against real-world shapes: FK chains to navigate,
-- a native-enum status column, money-as-integer-cents, timestamps.
-- Runs first (lexicographic order) so 02-roles.sql can grant on existing
-- tables and 03-seed.sql can insert. Executed against POSTGRES_DB=sampledb.

CREATE TABLE customers (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email      text NOT NULL UNIQUE,
  country    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  stock       integer NOT NULL DEFAULT 0 CHECK (stock >= 0)
);

-- Native Postgres enum (not a CHECK): introspection captures its labels so the
-- typed record editor renders orders.status as a fixed-choice dropdown.
CREATE TYPE order_status AS ENUM ('pending', 'paid', 'shipped', 'delivered', 'cancelled');

CREATE TABLE orders (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id bigint NOT NULL REFERENCES customers (id),
  status      order_status NOT NULL DEFAULT 'pending',
  placed_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  order_id         bigint NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id       bigint NOT NULL REFERENCES products (id),
  quantity         integer NOT NULL CHECK (quantity > 0),
  -- Price snapshot at order time: order totals must survive product repricing.
  unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),
  PRIMARY KEY (order_id, product_id)
);

-- FK columns Postgres does not index automatically + the two common access
-- paths (orders by status, orders by date) the explorer will filter/sort on.
CREATE INDEX orders_customer_id_idx ON orders (customer_id);
CREATE INDEX orders_status_idx ON orders (status);
CREATE INDEX orders_placed_at_idx ON orders (placed_at);
CREATE INDEX order_items_product_id_idx ON order_items (product_id);
