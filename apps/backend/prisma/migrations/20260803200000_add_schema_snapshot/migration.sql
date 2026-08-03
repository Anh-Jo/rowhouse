-- CreateTable
CREATE TABLE "SchemaTable" (
    "id" TEXT NOT NULL,
    "datasourceId" TEXT NOT NULL,
    "schema" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchemaTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemaColumn" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "isNullable" BOOLEAN NOT NULL,
    "isPrimaryKey" BOOLEAN NOT NULL,
    "refTable" TEXT,
    "refColumn" TEXT,
    "position" INTEGER NOT NULL,
    "description" TEXT,
    "isPii" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SchemaColumn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchemaTable_datasourceId_idx" ON "SchemaTable"("datasourceId");

-- CreateIndex
CREATE UNIQUE INDEX "SchemaTable_datasourceId_schema_name_key" ON "SchemaTable"("datasourceId", "schema", "name");

-- CreateIndex
CREATE INDEX "SchemaColumn_tableId_idx" ON "SchemaColumn"("tableId");

-- CreateIndex
CREATE UNIQUE INDEX "SchemaColumn_tableId_name_key" ON "SchemaColumn"("tableId", "name");

-- AddForeignKey
ALTER TABLE "SchemaTable" ADD CONSTRAINT "SchemaTable_datasourceId_fkey" FOREIGN KEY ("datasourceId") REFERENCES "Datasource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemaColumn" ADD CONSTRAINT "SchemaColumn_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "SchemaTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

