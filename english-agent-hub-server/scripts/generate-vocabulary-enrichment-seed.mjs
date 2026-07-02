#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const apiBaseUrl = process.env.EAH_API_URL ?? "http://localhost:3301";
const email = process.env.EAH_ADMIN_EMAIL;
const password = process.env.EAH_ADMIN_PASSWORD;
const batchSize = Number(process.env.EAH_BATCH_SIZE ?? "20");
const outputPath = resolve(
  process.env.EAH_OUTPUT ??
    "src/main/resources/seed/english-vocabulary-enrichments-2022.json",
);

if (!email || !password) {
  console.error("EAH_ADMIN_EMAIL and EAH_ADMIN_PASSWORD are required.");
  process.exit(1);
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${options.method ?? "GET"} ${path} failed: ${response.status} ${body}`);
  }
  return response.json();
}

const login = await request("/api/auth/login", {
  method: "POST",
  body: JSON.stringify({ email, password }),
});

const authHeaders = { Authorization: `Bearer ${login.accessToken}` };

let totalCompleted = 0;
let round = 0;

while (true) {
  round += 1;
  const result = await request(
    `/api/reference-data/english-vocabulary/enrich?limit=${encodeURIComponent(batchSize)}`,
    { method: "POST", headers: authHeaders },
  );
  totalCompleted += result.completed;
  console.log(`round=${round} picked=${result.picked} completed=${result.completed} total=${totalCompleted}`);
  if (result.picked === 0 || result.completed === 0) break;
}

const seed = await request("/api/reference-data/english-vocabulary/enrichments/export", {
  headers: authHeaders,
});

await writeFile(outputPath, `${JSON.stringify(seed, null, 2)}\n`, "utf8");
console.log(`wrote ${seed.length} enrichment rows to ${outputPath}`);
