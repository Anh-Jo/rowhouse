-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CONNECTION_TEST', 'INTROSPECT', 'READ');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('OK', 'ERROR');

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "datasourceId" TEXT,
    "role" "CredentialRole",
    "action" "AuditAction" NOT NULL,
    "statement" TEXT,
    "paramsDigest" TEXT,
    "rowCount" INTEGER,
    "durationMs" INTEGER NOT NULL,
    "status" "AuditStatus" NOT NULL,
    "errorMessage" TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditEvent_workspaceId_createdAt_id_idx" ON "AuditEvent"("workspaceId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "AuditEvent_datasourceId_idx" ON "AuditEvent"("datasourceId");

