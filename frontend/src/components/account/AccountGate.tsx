import type { ReactNode } from "react";
import { useAccount } from "./useAccount";
import JourneyIntro, { type JourneyKind } from "./JourneyIntro";
export default function AccountGate({
  kind,
  children,
}: {
  kind: JourneyKind;
  children: ReactNode;
}) {
  const { user } = useAccount();
  return user ? children : <JourneyIntro kind={kind} />;
}
