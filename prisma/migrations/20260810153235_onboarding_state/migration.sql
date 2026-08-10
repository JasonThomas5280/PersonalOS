-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "commuteHours" DECIMAL(5,1),
ADD COLUMN     "existingHours" DECIMAL(5,1),
ADD COLUMN     "familyHours" DECIMAL(5,1),
ADD COLUMN     "householdHours" DECIMAL(5,1),
ADD COLUMN     "onboardedAt" TIMESTAMP(3),
ADD COLUMN     "sleepHours" DECIMAL(5,1),
ADD COLUMN     "workHours" DECIMAL(5,1);
