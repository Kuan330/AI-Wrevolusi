import type { ReactNode } from "react";
import { useAccount } from "./useAccount";
import JourneyIntro, { type JourneyKind } from "./JourneyIntro";

export default function AccountGate(props: {
  kind: JourneyKind;
  children: ReactNode;
}) {
  const { kind, children } = props;
  const { user } = useAccount();
  return user ? children : <JourneyIntro kind={kind} />;
}
