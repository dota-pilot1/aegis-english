"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AgentChatClient } from "./AgentChatClient";

export function AgentChatGate({ variant = "desktop" }: { variant?: "desktop" | "mobile" }) {
  const params = useSearchParams();
  const router = useRouter();
  const agentId = params.get("id") ?? "debate";

  useEffect(() => {
    if (variant !== "desktop") return;

    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const routeToMobile = () => {
      if (!mobileQuery.matches) return;
      const query = params.toString();
      router.replace(`/agents/mobile${query ? `?${query}` : ""}`);
    };

    routeToMobile();
    mobileQuery.addEventListener("change", routeToMobile);
    return () => mobileQuery.removeEventListener("change", routeToMobile);
  }, [params, router, variant]);

  useEffect(() => {
    if (variant !== "mobile") return;

    const desktopQuery = window.matchMedia("(min-width: 768px)");
    const routeToDesktop = () => {
      if (!desktopQuery.matches) return;
      const query = params.toString();
      router.replace(`/agents/${query ? `?${query}` : ""}`);
    };

    routeToDesktop();
    desktopQuery.addEventListener("change", routeToDesktop);
    return () => desktopQuery.removeEventListener("change", routeToDesktop);
  }, [params, router, variant]);

  return <AgentChatClient key={agentId} agentId={agentId} variant={variant} />;
}
