#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const rootDir = resolve(process.cwd(), "..");
const envPath = resolve(rootDir, ".env");
const vocabularyPath = resolve("src/main/resources/seed/english-vocabulary-2022.json");
const outputPath = resolve("src/main/resources/seed/english-vocabulary-enrichments-2022.json");
const batchSize = Number(process.env.EAH_BATCH_SIZE ?? "25");
const model = process.env.OPENAI_VOCABULARY_MODEL ?? process.env.OPENAI_TRANSLATION_MODEL ?? "gpt-4.1-mini";
const regenerate = process.env.EAH_REGENERATE === "1";

async function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = await readFile(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (process.env[key]) continue;
    let value = rest.join("=").trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key.trim()] = value;
  }
}

function stripFence(content) {
  return (content ?? "")
    .replace(/^```(?:json)?\s*/s, "")
    .replace(/\s*```$/s, "")
    .trim();
}

function normalizeExisting(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!row?.curriculumVersion || !row?.headword) continue;
    map.set(`${row.curriculumVersion}::${row.headword}`, row);
  }
  return map;
}

async function callOpenAI(items) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an editor of a Korean-English dictionary for Korean middle and high-school learners. Return only valid JSON.",
        },
        {
          role: "user",
          content: `For each item, generate Korean dictionary-style vocabulary data for an educational word list.
Return JSON with this exact shape:
{
  "items": [
    {
      "headword": "same headword",
      "meaningKo": "Korean-English dictionary style meanings, 1-3 frequent senses, joined with comma",
      "partOfSpeech": "Korean part of speech, e.g. 명사, 동사, 형용사, 부사, 전치사",
      "exampleSentence": "natural English example sentence",
      "exampleTranslation": "natural Korean translation"
    }
  ]
}

Rules:
- Preserve each input headword exactly in "headword".
- meaningKo must be a headword definition, not a translation fitted only to the example sentence.
- Do not translate literally. Use natural Korean expressions used in actual English-Korean dictionaries.
- If there are multiple meanings, include only the most frequent 1-3 meanings.
- Keep meaningKo concise.
- Prefer dictionary-style expressions such as "~에 관하여", "~위에", "약 ~", "~쯤".
- Prefer dictionary words like "풍부하다", "존재하다" over loose phrases like "많이 있다" when appropriate.
- Include representative meanings by part of speech.
- Use natural Korean suitable for Korean middle/high-school educational vocabulary books.
- Use Korean for meaningKo, partOfSpeech, and exampleTranslation.
- Use "/" for multiple parts of speech, for example 명사/동사.
- Keep example sentences suitable for Korean middle/high-school learners.
- For function words like "a", give a practical Korean explanation.
- Do not omit any input item.

Examples:
Input headword: aboard
Output meaningKo: "배·기차·비행기 등에 탑승한, 탑승하여"
Output partOfSpeech: "부사/전치사"

Input headword: about
Output meaningKo: "~에 관하여, 약 ~, ~쯤"
Output partOfSpeech: "전치사/부사"

Input:
${JSON.stringify(
            items.map((item) => ({
              headword: item.headword,
              rawEntry: item.rawEntry,
              level: item.marker,
            })),
            null,
            2,
          )}`,
        },
      ],
      max_completion_tokens: 6000,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${body}`);
  }
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`OpenAI returned empty content: ${JSON.stringify(payload).slice(0, 1000)}`);
  }
  const parsed = JSON.parse(stripFence(content));
  if (!Array.isArray(parsed.items)) {
    throw new Error(`Invalid response shape: ${content}`);
  }
  return parsed.items;
}

await loadEnvFile(envPath);
if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is required in ../.env or environment.");
  process.exit(1);
}

const vocabulary = JSON.parse(await readFile(vocabularyPath, "utf8"));
const existing = existsSync(outputPath)
  ? JSON.parse(await readFile(outputPath, "utf8"))
  : [];
const enriched = regenerate ? new Map() : normalizeExisting(existing);

let completedThisRun = 0;
let batchNo = 0;

while (true) {
  const pending = vocabulary
    .filter((item) => !enriched.has(`${item.curriculumVersion}::${item.headword}`))
    .slice(0, batchSize);
  if (pending.length === 0) break;

  batchNo += 1;
  const generated = await callOpenAI(pending);
  pending.forEach((item, index) => {
    const match = generated.find((row) => row.headword === item.headword) ?? generated[index];
    if (!match) {
      console.warn(`missing generated item: ${item.headword}`);
      return;
    }
    enriched.set(`${item.curriculumVersion}::${item.headword}`, {
      curriculumVersion: item.curriculumVersion,
      headword: item.headword,
      meaningKo: match.meaningKo ?? "",
      partOfSpeech: match.partOfSpeech ?? "",
      exampleSentence: match.exampleSentence ?? "",
      exampleTranslation: match.exampleTranslation ?? "",
      generatedModel: model,
    });
    completedThisRun += 1;
  });

  const rows = Array.from(enriched.values()).sort((a, b) => {
    const ai = vocabulary.find((item) => item.headword === a.headword)?.sortOrder ?? 0;
    const bi = vocabulary.find((item) => item.headword === b.headword)?.sortOrder ?? 0;
    return ai - bi;
  });
  await writeFile(outputPath, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  console.log(`batch=${batchNo} generated=${generated.length} total=${rows.length} run=${completedThisRun}`);
}

console.log(`done. generated_this_run=${completedThisRun} output=${outputPath}`);
