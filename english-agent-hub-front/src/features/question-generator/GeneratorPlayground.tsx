"use client";

import type { ReactNode } from "react";
import { Sparkles, type LucideIcon } from "lucide-react";

export type GeneratorKind = "english" | "math";

type GeneratorPlaygroundProps = {
  /** 화면 제목 (예: "영어 문제 생성기") */
  title: string;
  /** 한 줄 설명 */
  description: string;
  /** 상단 배지 아이콘 */
  icon: LucideIcon;
  /** 테스트해볼 생성 방식 목록 */
  strategies: { name: string; summary: string }[];
  /** 헤더와 전략 카드 사이에 끼울 추가 슬롯 (예: 동작하는 MVP 패널) */
  extra?: ReactNode;
};

/**
 * 문제 생성 실험실 — 여러 생성 방식을 한 화면에서 테스트하기 위한 스캐폴드.
 * 실제 생성 파이프라인(명세 추출 → 신규 지문 생성 → 유사도 가드)은 추후 연결한다.
 */
export function GeneratorPlayground({ title, description, icon: Icon, strategies, extra }: GeneratorPlaygroundProps) {
  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-muted/25 px-4 py-5">
      <div className="mx-auto w-full max-w-[1280px] space-y-6">
        <section className="border-b border-border pb-5">
          <div className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-semibold text-muted-foreground">
            <Icon className="h-4 w-4" />
            Question Generator
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </section>

        {extra}

        {strategies.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {strategies.map((strategy) => (
            <div
              key={strategy.name}
              className="rounded-lg border border-border bg-background p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
                  <Sparkles className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-bold">{strategy.name}</h3>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{strategy.summary}</p>
              <button
                type="button"
                disabled
                className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-md border border-dashed border-border text-sm font-semibold text-muted-foreground"
              >
                준비 중
              </button>
            </div>
          ))}
        </section>
        )}
      </div>
    </main>
  );
}
