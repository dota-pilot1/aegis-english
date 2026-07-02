"use client";

import katex from "katex";
import "katex/dist/katex.min.css";

type Segment = { math: boolean; block: boolean; content: string };

/** 한글 텍스트 사이에 $...$(인라인) / $$...$$(블록) 수식이 섞인 문자열을 토큰으로 분리. */
function segments(text: string): Segment[] {
  const out: Segment[] = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ math: false, block: false, content: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ math: true, block: true, content: m[1] });
    else out.push({ math: true, block: false, content: m[2] });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ math: false, block: false, content: text.slice(last) });
  return out;
}

/** 발문·보기처럼 한글+LaTeX가 섞인 텍스트를 KaTeX로 렌더한다. 수식 파싱 실패는 원문 표시로 폴백. */
export function MathText({ text, className }: { text: string | null | undefined; className?: string }) {
  if (!text) return null;
  return (
    <span className={className}>
      {segments(text).map((p, i) => {
        if (!p.math) {
          return (
            <span key={i} style={{ whiteSpace: "pre-wrap" }}>
              {p.content}
            </span>
          );
        }
        try {
          const html = katex.renderToString(p.content, { throwOnError: false, displayMode: p.block });
          return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
        } catch {
          return <span key={i}>{`$${p.content}$`}</span>;
        }
      })}
    </span>
  );
}
