/*
  Warnings:

  - A unique constraint covering the columns `[id]` on the table `docs` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "docs_id_key" ON "docs"("id");
