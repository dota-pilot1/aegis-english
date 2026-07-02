import { Suspense } from "react";
import { RequireAuth } from "@/widgets/guards/RequireAuth";
import { AgentChatGate } from "./AgentChatGate";

// 정적 export(S3/CloudFront)에서는 임의 동적 경로(/agents/1)를 미리 생성할 수 없어 403이 난다.
// 단일 정적 페이지로 두고 에이전트 id는 ?id= 쿼리스트링으로 전달한다.
export default function AgentChatPage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <AgentChatGate />
      </Suspense>
    </RequireAuth>
  );
}
