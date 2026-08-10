import { notFound } from "next/navigation";
import { stepIndex } from "../steps";
import { WelcomeStep } from "../_steps/Welcome";
import { MissionStep } from "../_steps/Mission";
import { RolesStep } from "../_steps/Roles";
import { DepthStep } from "../_steps/Depth";
import { CapacityStep } from "../_steps/Capacity";
import { OutcomesStep } from "../_steps/Outcomes";
import { RenewalStep } from "../_steps/Renewal";
import { RaidStep } from "../_steps/Raid";
import { PeopleStep } from "../_steps/People";
import { RhythmStep } from "../_steps/Rhythm";
import { DoneStep } from "../_steps/Done";

// Every step reads current state so revisiting shows what was already saved.
export const dynamic = "force-dynamic";

const RENDERERS: Record<string, () => React.ReactNode> = {
  welcome: WelcomeStep,
  mission: MissionStep,
  roles: RolesStep,
  depth: DepthStep,
  capacity: CapacityStep,
  outcomes: OutcomesStep,
  renewal: RenewalStep,
  raid: RaidStep,
  people: PeopleStep,
  rhythm: RhythmStep,
  done: DoneStep,
};

export default async function OnboardingStep({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  const Render = RENDERERS[step];
  if (stepIndex(step) < 0 || !Render) notFound();
  return <Render />;
}
