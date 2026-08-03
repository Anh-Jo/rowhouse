-- CreateEnum
CREATE TYPE "DatasourceType" AS ENUM ('POSTGRES');

-- CreateEnum
CREATE TYPE "DatasourceSslMode" AS ENUM ('DISABLE', 'REQUIRE');

-- CreateEnum
CREATE TYPE "CredentialRole" AS ENUM ('READ_ONLY', 'READ_WRITE');

-- CreateTable
CREATE TABLE "Datasource" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DatasourceType" NOT NULL DEFAULT 'POSTGRES',
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "database" TEXT NOT NULL,
    "sslMode" "DatasourceSslMode" NOT NULL DEFAULT 'REQUIRE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Datasource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasourceCredential" (
    "id" TEXT NOT NULL,
    "datasourceId" TEXT NOT NULL,
    "role" "CredentialRole" NOT NULL,
    "username" TEXT NOT NULL,
    "secretSealed" BYTEA NOT NULL,
    "dekWrapped" BYTEA NOT NULL,
    "dekKeyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatasourceCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Datasource_projectId_idx" ON "Datasource"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Datasource_projectId_name_key" ON "Datasource"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "DatasourceCredential_datasourceId_role_key" ON "DatasourceCredential"("datasourceId", "role");

-- AddForeignKey
ALTER TABLE "Datasource" ADD CONSTRAINT "Datasource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasourceCredential" ADD CONSTRAINT "DatasourceCredential_datasourceId_fkey" FOREIGN KEY ("datasourceId") REFERENCES "Datasource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

