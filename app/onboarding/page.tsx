import { redirect } from "next/navigation";
import { href, STEPS } from "./steps";

/** /onboarding is the flow's front door — send it to the first step. */
export default function OnboardingIndex() {
  redirect(href(STEPS[0].slug));
}
