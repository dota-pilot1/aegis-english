import { Suspense } from "react";
import { RequireAuth } from "@/widgets/guards/RequireAuth";
import { AgentChatGate } from "../AgentChatGate";

export default function AgentChatMobilePage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <AgentChatGate variant="mobile" />
      </Suspense>
    </RequireAuth>
  );
}
