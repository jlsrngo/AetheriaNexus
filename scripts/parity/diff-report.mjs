// Deterministic diff comparator between golden/*.ndjson (OpenCode) and actual/*.ndjson (Aetheria).
// Usage: node scripts/parity/diff-report.mjs [--golden scripts/parity/golden] [--actual scripts/parity/actual]
//        [--report-dir scripts/parity/report] [--only K01,K02] [--shuffle 42]
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, subsetMatch } from "./lib/assert.mjs";
import { scenarios, TOTAL } from "./lib/scenarios.mjs";

export function seededShuffle(list, seed) {
  const out = [...list];
  let s = (Number(seed) || 1) >>> 0;
  const rand = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function readNdjson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const lines = fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  return lines.map((line, lineIdx) => {
    try {
      return JSON.parse(line);
    } catch {
      return { kind: "parse.error", line: lineIdx + 1, raw: line.slice(0, 120) };
    }
  });
}

export function compareScenarioNdjson(id, goldenDir, actualDir, runtimeCheckError = null) {
  const goldenPath = path.join(goldenDir, `${id}.ndjson`);
  const actualPath = path.join(actualDir, `${id}.ndjson`);

  const goldenRows = readNdjson(goldenPath);
  if (!goldenRows || goldenRows.length === 0) {
    return [`golden missing or empty: ${goldenPath}`];
  }
  const actualRows = readNdjson(actualPath);
  if (!actualRows || actualRows.length === 0) {
    return [`actual missing or empty: ${actualPath}`];
  }

  const errRow = actualRows.find((r) => r.kind === "runner.error" || r.kind === "parse.error");
  if (errRow) {
    return [errRow.detail ?? `runner error: ${describe(errRow)}`];
  }

  const failures = [];
  const goldenEvents = goldenRows.filter((r) => r.kind !== "provider.request");
  const actualEvents = actualRows.filter((r) => r.kind !== "provider.request");
  const goldenReqs = goldenRows.filter((r) => r.kind === "provider.request");
  const actualReqs = actualRows.filter((r) => r.kind === "provider.request");

  if (actualEvents.length !== goldenEvents.length) {
    failures.push(`event count ${actualEvents.length} !== golden ${goldenEvents.length}`);
  } else {
    for (let idx = 0; idx < goldenEvents.length; idx++) {
      if (!subsetMatch(actualEvents[idx], goldenEvents[idx]) || !subsetMatch(goldenEvents[idx], actualEvents[idx])) {
        failures.push(`event[${idx}] mismatch: actual=${describe(actualEvents[idx])} vs golden=${describe(goldenEvents[idx])}`);
        break;
      }
    }
  }

  if (actualReqs.length !== goldenReqs.length) {
    failures.push(`provider requests ${actualReqs.length} !== golden ${goldenReqs.length}`);
  } else {
    for (let idx = 0; idx < goldenReqs.length; idx++) {
      if (!subsetMatch(actualReqs[idx], goldenReqs[idx]) || !subsetMatch(goldenReqs[idx], actualReqs[idx])) {
        failures.push(`request[${idx}] mismatch: actual=${describe(actualReqs[idx])} vs golden=${describe(goldenReqs[idx])}`);
        break;
      }
    }
  }

  if (runtimeCheckError) failures.push(runtimeCheckError);
  return failures;
}

export function readGoldenOracleLabel(goldenDir) {
  const manifestPath = path.join(goldenDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) return `ORACLE golden (${goldenDir})`;
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    return `ORACLE golden OpenCode (${manifest.opencodeCommit ?? "unknown"})`;
  } catch {
    return `ORACLE golden (${goldenDir})`;
  }
}

export function writeParityReport(results, { reportDir, oracleLabel, extraFiles = {} }) {
  const ordered = [...results].sort((a, b) => a.id.localeCompare(b.id));
  const passed = ordered.filter((r) => r.ok).length;
  const denom = ordered.length === TOTAL ? TOTAL : ordered.length;
  const score = denom > 0 ? (passed / denom) * 100 : 0;

  const w = (s, n) => String(s).padEnd(n);
  console.log(`${w("ID", 5)}${w("WS", 5)}${w("STATUS", 15)}DETAIL`);
  for (const r of ordered) {
    console.log(`${w(r.id, 5)}${w(r.ws, 5)}${w(r.status, 15)}${r.detail ?? ""}`);
  }
  console.log("");
  console.log(oracleLabel);
  console.log(`SCORE ${passed}/${denom} (${score.toFixed(1)}%)`);

  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, "score.txt"), `${oracleLabel}\nSCORE ${passed}/${denom} (${score.toFixed(1)}%)\n`);
  const failureLines = ordered.filter((r) => !r.ok).map((r) => JSON.stringify(r)).join("\n");
  fs.writeFileSync(path.join(reportDir, "failures.ndjson"), failureLines ? `${failureLines}\n` : "");
  for (const [name, content] of Object.entries(extraFiles)) {
    fs.writeFileSync(path.join(reportDir, name), content);
  }
  return { passed, total: denom, score, ordered };
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    out[key] = next && !next.startsWith("--") ? argv[++i] : true;
  }
  return out;
}

const isCli = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCli) {
  const args = parseArgs(process.argv.slice(2));
  const goldenDir = path.resolve(String(args.golden ?? path.join(process.cwd(), "scripts", "parity", "golden")));
  const actualDir = path.resolve(String(args.actual ?? path.join(process.cwd(), "scripts", "parity", "actual")));
  const reportDir = path.resolve(String(args["report-dir"] ?? path.join(process.cwd(), "scripts", "parity", "report")));
  const only = args.only ? new Set(String(args.only).split(",")) : null;

  let list = scenarios.filter((s) => !only || only.has(s.id));
  if (args.shuffle !== undefined) {
    const seed = args.shuffle === true ? 1 : Number(args.shuffle);
    list = seededShuffle(list, seed);
  }

  let runtimeErrors = {};
  const metaPath = path.join(actualDir, "_runtime_checks.json");
  if (fs.existsSync(metaPath)) {
    try {
      runtimeErrors = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    } catch {}
  }

  const results = list.map((s) => {
    const failures = compareScenarioNdjson(s.id, goldenDir, actualDir, runtimeErrors[s.id] ?? null);
    return {
      id: s.id,
      ws: s.ws,
      title: s.title,
      ok: failures.length === 0,
      status: failures.length === 0 ? "PASS" : "FAIL",
      detail: failures.join("; "),
    };
  });

  const oracleLabel = readGoldenOracleLabel(goldenDir);
  const { passed, total } = writeParityReport(results, { reportDir, oracleLabel });
  process.exitCode = passed === total ? 0 : 1;
}

