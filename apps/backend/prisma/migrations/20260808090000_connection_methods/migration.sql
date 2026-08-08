-- Connection methods (decision D12): the "how do we reach it" columns move
-- off Datasource into one dedicated table per method. Hand-ordered from the
-- `prisma migrate diff` output so it is a data-MOVING migration, not a
-- data-losing one: create the method tables → copy every existing datasource
-- into DirectConnection (all pre-D12 datasources are direct by definition)
-- → only then drop the moved columns. The PGlite e2e runner replays this
-- file, so the copy step is exercised by every e2e run.

-- CreateEnum
CREATE TYPE "ConnectionMethod" AS ENUM ('DIRECT', 'CLOUDSQL');

-- CreateEnum
CREATE TYPE "CloudSqlAuthType" AS ENUM ('IAM', 'BUILT_IN');

-- CreateTable
CREATE TABLE "DirectConnection" (
    "id" TEXT NOT NULL,
    "datasourceId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "database" TEXT NOT NULL,
    "sslMode" "DatasourceSslMode" NOT NULL DEFAULT 'REQUIRE',
    "caCert" TEXT,

    CONSTRAINT "DirectConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudSqlConnection" (
    "id" TEXT NOT NULL,
    "datasourceId" TEXT NOT NULL,
    "instanceConnectionName" TEXT NOT NULL,
    "database" TEXT NOT NULL,
    "authType" "CloudSqlAuthType" NOT NULL,
    "saKeySealed" BYTEA NOT NULL,
    "saKeyDekWrapped" BYTEA NOT NULL,
    "saKeyDekKeyId" TEXT NOT NULL,

    CONSTRAINT "CloudSqlConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DirectConnection_datasourceId_key" ON "DirectConnection"("datasourceId");

-- CreateIndex
CREATE UNIQUE INDEX "CloudSqlConnection_datasourceId_key" ON "CloudSqlConnection"("datasourceId");

-- AddForeignKey
ALTER TABLE "DirectConnection" ADD CONSTRAINT "DirectConnection_datasourceId_fkey" FOREIGN KEY ("datasourceId") REFERENCES "Datasource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudSqlConnection" ADD CONSTRAINT "CloudSqlConnection_datasourceId_fkey" FOREIGN KEY ("datasourceId") REFERENCES "Datasource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMove: every pre-D12 datasource was reached directly — copy its
-- connection columns into the new method table before dropping them. The new
-- row id must be deterministic (this script replays on every environment and
-- in every PGlite e2e boot): derive it from the datasource id.
INSERT INTO "DirectConnection" ("id", "datasourceId", "host", "port", "database", "sslMode")
SELECT "id" || '-direct', "id", "host", "port", "database", "sslMode"
FROM "Datasource";

-- AlterTable: the moved columns leave Datasource; the discriminator arrives.
-- Its DEFAULT 'DIRECT' backfills existing rows, which all just received a
-- DirectConnection row above — the D12 invariant holds through the move.
ALTER TABLE "Datasource" DROP COLUMN "database",
DROP COLUMN "host",
DROP COLUMN "port",
DROP COLUMN "sslMode",
ADD COLUMN     "connectionMethod" "ConnectionMethod" NOT NULL DEFAULT 'DIRECT';
