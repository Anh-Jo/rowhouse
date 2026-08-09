-- AlterTable
ALTER TABLE "SchemaColumn" ADD COLUMN     "enumValues" TEXT[] DEFAULT ARRAY[]::TEXT[];
