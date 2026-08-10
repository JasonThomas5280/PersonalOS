-- CreateEnum
CREATE TYPE "Phase" AS ENUM ('EXPLORING', 'BUILDING', 'TESTING', 'DEPLOYING', 'HYPERCARE', 'CLOSED');

-- CreateEnum
CREATE TYPE "Health" AS ENUM ('GREEN', 'YELLOW', 'RED');

-- CreateEnum
CREATE TYPE "RaidType" AS ENUM ('RISK', 'ACTION', 'ISSUE', 'DECISION');

-- CreateEnum
CREATE TYPE "RaidStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'BLOCKED', 'DEFERRED', 'CLOSED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('S1', 'S2', 'S3', 'S4');

-- CreateEnum
CREATE TYPE "Probability" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "IssueClassification" AS ENUM ('STRUCTURAL_GAP', 'EXECUTION_DEFECT', 'CONFIGURATION', 'SKILL_GAP', 'ENVIRONMENT', 'DEPENDS_ON_OTHERS');

-- CreateEnum
CREATE TYPE "Ring" AS ENUM ('INNER', 'WORKING', 'AMBIENT');

-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('SPOT', 'ASSESS', 'DEVELOP', 'MAINTAIN');

-- CreateEnum
CREATE TYPE "Engine" AS ENUM ('MONEY', 'IDEOLOGY', 'CONNECTION', 'EGO');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "NodeType" AS ENUM ('SUPER_CONNECTOR', 'GATEKEEPER', 'HUB');

-- CreateEnum
CREATE TYPE "ContributionCategory" AS ENUM ('INFORMATIONAL', 'CONNECTIVE', 'TIME', 'ACKNOWLEDGMENT', 'OPERATIONAL', 'PRESENCE');

-- CreateEnum
CREATE TYPE "Quadrant" AS ENUM ('Q1', 'Q2', 'Q3', 'Q4');

-- CreateEnum
CREATE TYPE "SawDimension" AS ENUM ('PHYSICAL', 'MENTAL', 'SPIRITUAL', 'SOCIAL');

-- CreateEnum
CREATE TYPE "SawCadence" AS ENUM ('DAILY', 'FIVE_X_WEEK', 'THREE_X_WEEK', 'WEEKLY', 'BIWEEKLY');

-- CreateEnum
CREATE TYPE "ReviewCadence" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY');

-- CreateTable
CREATE TABLE "Profile" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "mission" TEXT NOT NULL DEFAULT '',
    "capacityBudget" DECIMAL(5,1) NOT NULL DEFAULT 12,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '◈',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "health" "Health",
    "statusNote" TEXT NOT NULL DEFAULT '',
    "mission" TEXT NOT NULL DEFAULT '',
    "success" TEXT NOT NULL DEFAULT '',
    "stewardship" TEXT NOT NULL DEFAULT '',
    "failureMode" TEXT NOT NULL DEFAULT '',
    "reviewCadence" "ReviewCadence",
    "lastReviewed" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outcome" (
    "id" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT '',
    "actions" TEXT NOT NULL DEFAULT '',
    "phase" "Phase" NOT NULL DEFAULT 'EXPLORING',
    "primaryRoleId" TEXT,
    "baselineDate" DATE,
    "targetDate" DATE,
    "actualDate" DATE,
    "leadTimeDays" INTEGER,
    "weeklyHours" DECIMAL(5,1),
    "criticalPath" BOOLEAN NOT NULL DEFAULT false,
    "successCriteria" TEXT NOT NULL DEFAULT '',
    "killCriteria" TEXT NOT NULL DEFAULT '',
    "exitCriteria" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Outcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutcomeRole" (
    "outcomeId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "OutcomeRole_pkey" PRIMARY KEY ("outcomeId","roleId")
);

-- CreateTable
CREATE TABLE "OutcomeDependency" (
    "blockedId" TEXT NOT NULL,
    "blockingId" TEXT NOT NULL,

    CONSTRAINT "OutcomeDependency_pkey" PRIMARY KEY ("blockedId","blockingId")
);

-- CreateTable
CREATE TABLE "GateItem" (
    "id" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "met" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaidItem" (
    "id" TEXT NOT NULL,
    "type" "RaidType" NOT NULL,
    "description" TEXT NOT NULL,
    "impact" TEXT NOT NULL DEFAULT '',
    "status" "RaidStatus" NOT NULL DEFAULT 'OPEN',
    "owner" TEXT NOT NULL DEFAULT 'Me',
    "due" DATE,
    "trigger" TEXT NOT NULL DEFAULT '',
    "severity" "Severity",
    "probability" "Probability",
    "classification" "IssueClassification",
    "escalation" TEXT NOT NULL DEFAULT '',
    "alternatives" TEXT NOT NULL DEFAULT '',
    "decidedBy" TEXT NOT NULL DEFAULT '',
    "decidedOn" DATE,
    "resolution" TEXT NOT NULL DEFAULT '',
    "closedOn" DATE,
    "roleId" TEXT,
    "outcomeId" TEXT,
    "personId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaidItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "employer" TEXT NOT NULL DEFAULT '',
    "familyContext" TEXT NOT NULL DEFAULT '',
    "ring" "Ring" NOT NULL DEFAULT 'WORKING',
    "stage" "Stage" NOT NULL DEFAULT 'SPOT',
    "origin" TEXT NOT NULL DEFAULT '',
    "firstContact" DATE,
    "lastContact" DATE,
    "cadenceDays" INTEGER,
    "primaryEngine" "Engine",
    "secondaryEngine" "Engine",
    "rejectedEngine" "Engine",
    "engineConfidence" "Confidence" NOT NULL DEFAULT 'LOW',
    "archetype" TEXT NOT NULL DEFAULT '',
    "nodeType" "NodeType",
    "situation" TEXT NOT NULL DEFAULT '',
    "material" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonRole" (
    "personId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "PersonRole_pkey" PRIMARY KEY ("personId","roleId")
);

-- CreateTable
CREATE TABLE "PersonOutcome" (
    "personId" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,

    CONSTRAINT "PersonOutcome_pkey" PRIMARY KEY ("personId","outcomeId")
);

-- CreateTable
CREATE TABLE "Contribution" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "category" "ContributionCategory" NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "Contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commitment" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "due" DATE,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "completedOn" DATE,

    CONSTRAINT "Commitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PotentialContribution" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "PotentialContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BigThreeItem" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "slot" INTEGER NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "done" BOOLEAN NOT NULL DEFAULT false,
    "quadrant" "Quadrant",
    "roleId" TEXT,
    "outcomeId" TEXT,

    CONSTRAINT "BigThreeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SawPractice" (
    "id" TEXT NOT NULL,
    "dimension" "SawDimension" NOT NULL,
    "practice" TEXT NOT NULL DEFAULT '',
    "minimumViable" TEXT NOT NULL DEFAULT '',
    "cadence" "SawCadence",
    "sessionMinutes" INTEGER,
    "mvMinutes" INTEGER,
    "depletes" TEXT NOT NULL DEFAULT '',
    "health" "Health",
    "note" TEXT NOT NULL DEFAULT '',
    "roleId" TEXT,

    CONSTRAINT "SawPractice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SawSession" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "date" DATE NOT NULL,

    CONSTRAINT "SawSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReview" (
    "id" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "wins" TEXT NOT NULL DEFAULT '',
    "misses" TEXT NOT NULL DEFAULT '',
    "quadrant" TEXT NOT NULL DEFAULT '',
    "drift" TEXT NOT NULL DEFAULT '',
    "ledger" TEXT NOT NULL DEFAULT '',
    "blocked" TEXT NOT NULL DEFAULT '',
    "nextWeek" TEXT NOT NULL DEFAULT '',
    "gratitude" TEXT NOT NULL DEFAULT '',
    "health" "Health",
    "healthNote" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Retro" (
    "id" TEXT NOT NULL,
    "quarter" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "wentWell" TEXT NOT NULL DEFAULT '',
    "didnt" TEXT NOT NULL DEFAULT '',
    "rootCauses" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Retro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessChange" (
    "id" TEXT NOT NULL,
    "retroId" TEXT NOT NULL,
    "change" TEXT NOT NULL,
    "why" TEXT NOT NULL DEFAULT '',
    "target" DATE,
    "done" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProcessChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_slug_key" ON "Role"("slug");

-- CreateIndex
CREATE INDEX "RaidItem_status_type_idx" ON "RaidItem"("status", "type");

-- CreateIndex
CREATE INDEX "Person_ring_idx" ON "Person"("ring");

-- CreateIndex
CREATE INDEX "Contribution_personId_date_idx" ON "Contribution"("personId", "date");

-- CreateIndex
CREATE INDEX "Commitment_personId_done_idx" ON "Commitment"("personId", "done");

-- CreateIndex
CREATE INDEX "BigThreeItem_date_idx" ON "BigThreeItem"("date");

-- CreateIndex
CREATE UNIQUE INDEX "BigThreeItem_date_slot_key" ON "BigThreeItem"("date", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "SawPractice_dimension_key" ON "SawPractice"("dimension");

-- CreateIndex
CREATE UNIQUE INDEX "SawSession_practiceId_date_key" ON "SawSession"("practiceId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReview_weekStart_key" ON "WeeklyReview"("weekStart");

-- AddForeignKey
ALTER TABLE "Outcome" ADD CONSTRAINT "Outcome_primaryRoleId_fkey" FOREIGN KEY ("primaryRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutcomeRole" ADD CONSTRAINT "OutcomeRole_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "Outcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutcomeRole" ADD CONSTRAINT "OutcomeRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutcomeDependency" ADD CONSTRAINT "OutcomeDependency_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "Outcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutcomeDependency" ADD CONSTRAINT "OutcomeDependency_blockingId_fkey" FOREIGN KEY ("blockingId") REFERENCES "Outcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateItem" ADD CONSTRAINT "GateItem_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "Outcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidItem" ADD CONSTRAINT "RaidItem_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidItem" ADD CONSTRAINT "RaidItem_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "Outcome"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidItem" ADD CONSTRAINT "RaidItem_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonRole" ADD CONSTRAINT "PersonRole_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonRole" ADD CONSTRAINT "PersonRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonOutcome" ADD CONSTRAINT "PersonOutcome_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonOutcome" ADD CONSTRAINT "PersonOutcome_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "Outcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PotentialContribution" ADD CONSTRAINT "PotentialContribution_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BigThreeItem" ADD CONSTRAINT "BigThreeItem_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BigThreeItem" ADD CONSTRAINT "BigThreeItem_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "Outcome"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SawPractice" ADD CONSTRAINT "SawPractice_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SawSession" ADD CONSTRAINT "SawSession_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "SawPractice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessChange" ADD CONSTRAINT "ProcessChange_retroId_fkey" FOREIGN KEY ("retroId") REFERENCES "Retro"("id") ON DELETE CASCADE ON UPDATE CASCADE;
