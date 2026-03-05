-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "role_enum" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "training_type_enum" AS ENUM ('OFFLINE', 'ONLINE');

-- CreateEnum
CREATE TYPE "certificate_status_enum" AS ENUM ('SUBMITTED', 'NOT_SUBMITTED');

-- CreateEnum
CREATE TYPE "approval_status_enum" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "employee_id" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "department" VARCHAR(100) NOT NULL,
    "team" VARCHAR(100) NOT NULL,
    "role" "role_enum" NOT NULL,
    "is_first_login" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_trainings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "training_name" VARCHAR(255) NOT NULL,
    "type" "training_type_enum" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "hours" DECIMAL(6,1) NOT NULL,
    "cost" INTEGER,
    "institution" VARCHAR(255) NOT NULL,
    "certificate_status" "certificate_status_enum" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "certificate_file" VARCHAR(500),
    "approval_status" "approval_status_enum" NOT NULL DEFAULT 'PENDING',
    "approval_comment" TEXT,
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "credits" DECIMAL(4,1),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_trainings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_trainings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "training_name" VARCHAR(255) NOT NULL,
    "type" "training_type_enum" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "hours" DECIMAL(6,1) NOT NULL,
    "institution" VARCHAR(255) NOT NULL,
    "certificate_status" "certificate_status_enum" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "certificate_file" VARCHAR(500),
    "credits" DECIMAL(4,1),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_trainings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_lectures" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "lecture_name" VARCHAR(255) NOT NULL,
    "type" "training_type_enum" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "hours" DECIMAL(6,1) NOT NULL,
    "department_instructor" VARCHAR(255) NOT NULL,
    "credits" DECIMAL(4,1),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_lectures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "cert_name" VARCHAR(255) NOT NULL,
    "grade" VARCHAR(100) NOT NULL,
    "acquired_date" DATE NOT NULL,
    "credits" DECIMAL(4,1),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_id_key" ON "users"("employee_id");

-- CreateIndex
CREATE INDEX "external_trainings_user_id_idx" ON "external_trainings"("user_id");

-- CreateIndex
CREATE INDEX "external_trainings_approved_by_idx" ON "external_trainings"("approved_by");

-- CreateIndex
CREATE INDEX "internal_trainings_user_id_idx" ON "internal_trainings"("user_id");

-- CreateIndex
CREATE INDEX "internal_lectures_user_id_idx" ON "internal_lectures"("user_id");

-- CreateIndex
CREATE INDEX "certifications_user_id_idx" ON "certifications"("user_id");

-- AddForeignKey
ALTER TABLE "external_trainings" ADD CONSTRAINT "external_trainings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_trainings" ADD CONSTRAINT "external_trainings_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_trainings" ADD CONSTRAINT "internal_trainings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_lectures" ADD CONSTRAINT "internal_lectures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

