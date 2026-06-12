#!/usr/bin/env node
/**
 * Download emission-analytics-api data from `POST /year-to-date-cii-by-imos` ONLY.
 *
 * You supply the IMO list (this script does NOT enumerate the fleet). IMOs come
 * from --imos, or a file via --imos-file (JSON array or newline/comma-separated).
 *
 * Auth: the API is RBAC-gated. Provide a bearer token via the EA_TOKEN env var
 * (with or without the "Bearer " prefix) — from the Swagger "Authorize" box.
 *
 * Usage:
 *   EA_TOKEN="<token>" node scripts/download-ytd-cii.mjs --imos 9710022,9920760 [--year 2026]
 *   EA_TOKEN="<token>" node scripts/download-ytd-cii.mjs --imos-file imos.json --year 2026
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";

const BASE_URL =
  process.env.EMISSIONS_BASE_URL ?? "https://api.private.stage.zeronorth.app/emission-analytics-api";

const args = process.argv.slice(2);
const argVal = (flag, def) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const YEAR = Number(argVal("--year", "2026"));
const OUT_DIR = argVal("--out", "./ytd-cii-export");
const BATCH_SIZE = Number(argVal("--batch-size", "50"));

const rawToken = process.env.EA_TOKEN;
if (!rawToken) {
  console.error("ERROR: set EA_TOKEN to a bearer token with the emission-analytics role.");
  process.exit(1);
}
const AUTH = /^bearer\s+/i.test(rawToken) ? rawToken : `Bearer ${rawToken}`;

const parseImos = (s) =>
  [...new Set((s.match(/\d{7}/g) ?? []).map(Number))].filter((n) => Number.isInteger(n));

const loadImos = async () => {
  const inline = argVal("--imos", "");
  const file = argVal("--imos-file", "");
  if (inline) return parseImos(inline);
  if (file) return parseImos(await readFile(file, "utf8"));
  return [];
};

const post = async (path, body) => {
  const res = await fetch(new URL(BASE_URL + path), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: AUTH },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
};

const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

const toCsv = (records) => {
  const cols = ["imo", "rating", "cii", "dataCoverage"];
  const rows = records.map((r) => cols.map((c) => r?.[c] ?? "").join(","));
  return [cols.join(","), ...rows].join("\n");
};

const main = async () => {
  const imos = await loadImos();
  if (imos.length === 0) {
    console.error("ERROR: no IMOs. Pass --imos 9710022,9920760 or --imos-file imos.json");
    process.exit(1);
  }
  await mkdir(OUT_DIR, { recursive: true });
  console.error(`POST /year-to-date-cii-by-imos  year=${YEAR}  imos=${imos.length}  out=${OUT_DIR}\n`);

  const records = [];
  for (const [i, group] of chunk(imos, BATCH_SIZE).entries()) {
    const res = await post("/year-to-date-cii-by-imos", { imos: group, year: YEAR });
    const list = Array.isArray(res) ? res : [];
    records.push(...list);
    console.error(`  batch ${i + 1}: ${group.length} requested, ${list.length} returned (total ${records.length})`);
  }

  await writeFile(join(OUT_DIR, "year-to-date-cii.json"), JSON.stringify(records, null, 2));
  await writeFile(join(OUT_DIR, "year-to-date-cii.csv"), toCsv(records));
  const withCii = records.filter((r) => r?.cii != null).length;
  console.error(
    `\nDone. ${records.length} records → ${OUT_DIR}/year-to-date-cii.json (+ .csv)\n` +
      `  with cii value: ${withCii}   empty: ${records.length - withCii}`,
  );
};

main().catch((e) => {
  console.error("\nFAILED:", e.message);
  process.exit(1);
});
