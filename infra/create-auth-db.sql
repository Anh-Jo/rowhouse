-- Provisions the separate better-auth database alongside the app database.
-- Mounted into the Postgres container at /docker-entrypoint-initdb.d/, this runs
-- ONCE, only on a pristine data volume (empty PGDATA). If the volume already
-- exists, create the database manually, e.g.:
--   docker exec -i <postgres-container> psql -U rowhouse -d rowhouse \
--     -c "CREATE DATABASE rowhouse_auth OWNER rowhouse;"
CREATE DATABASE rowhouse_auth OWNER rowhouse;
