#!/usr/bin/env node
/**
 * Patch the ZAP frontend's empty-state splash with the "Vessel Tinder" welcome.
 *
 * Why a patch script: the splash lives in the installed `@0north/zap-frontend`
 * package (`src/components/chat/message-list.tsx`), rendered inside the
 * `{showSplash && ( … )}` block when the thread is empty. That file is NOT in
 * this repo — `zap serve` copies the frontend into a temp synthetic workspace.
 * So we keep the customization reproducible here and inject it at will.
 *
 * What it does: replaces the *interior* of the `{showSplash && ( … )}` JSX with
 * a self-contained ZN Tinder splash (scoped <style>, no new imports). Each chip
 * calls `onSuggestionSelect(prompt)` — which the frontend wires straight to
 * `sendMessage` — so clicking a chip sends that phrase as a user turn and the
 * agent routes it to the matching live vessel-tinder widget.
 *
 * It is idempotent: it re-finds the same `{showSplash && (` anchor and re-scans
 * to the matching `)` every run, so running twice yields the same result. The
 * first run saves a `<file>.znt-orig` backup; `--restore` puts it back.
 *
 * Usage:
 *   node scripts/patch-welcome-splash.mjs           # patch every discovered copy
 *   node scripts/patch-welcome-splash.mjs --restore # revert from backups
 *   node scripts/patch-welcome-splash.mjs --check    # report state, change nothing
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, sep } from "node:path";

const REL = join("@0north", "zap-frontend", "src", "components", "chat", "message-list.tsx");
const ANCHOR = "{showSplash && (";
const MARKER = "znt-splash"; // present in our injected JSX → lets us report "already patched"

const mode = process.argv.includes("--restore")
  ? "restore"
  : process.argv.includes("--check")
    ? "check"
    : "patch";

// ── The injected splash ──────────────────────────────────────────────────────
// Replaces the interior `( … )` of `{showSplash && ( … )}`. Self-contained:
// only relies on `onSuggestionSelect` (already in scope). Backticks for the CSS
// block are escaped because this whole thing is a JS template literal.
const SPLASH = `(
            <div className="znt-splash">
              <style>{\`
                .znt-splash { --navy:#13334a; --mint:#9fe1cb; --card:#fff; --hair:#e6eaec; --ink:#15181c; --ink-2:#5c636b; --ink-3:#9ba1a8; --elig-bg:#e1f5ee; --elig-ink:#0f6e56; font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; width:100%; display:flex; justify-content:center; }
                .znt-splash * { box-sizing:border-box; }
                .znt-card { background:var(--card); border:1px solid var(--hair); border-radius:16px; max-width:440px; width:100%; overflow:hidden; }
                .znt-hero { background:var(--navy); padding:22px 0 18px; display:flex; flex-direction:column; align-items:center; gap:8px; }
                .znt-scene { position:relative; width:170px; height:54px; }
                .znt-ship { position:absolute; bottom:0; font-size:30px; }
                .znt-ship-l { left:0; animation:znt-bob 3.2s ease-in-out infinite; }
                .znt-ship-r { right:0; animation:znt-bob 3.2s ease-in-out infinite; animation-delay:-1.6s; }
                .znt-heart { position:absolute; left:50%; top:2px; transform:translateX(-50%); font-size:20px; animation:znt-beat 1.3s ease-in-out infinite; }
                .znt-ahoy { margin:0; color:var(--mint); font-size:11px; letter-spacing:.12em; text-transform:uppercase; }
                @keyframes znt-bob { 0%,100%{ transform:translateY(0) rotate(-3deg);} 50%{ transform:translateY(-5px) rotate(3deg);} }
                @keyframes znt-beat { 0%,100%{ transform:translateX(-50%) scale(1);} 20%{ transform:translateX(-50%) scale(1.3);} 40%{ transform:translateX(-50%) scale(1);} }
                @media (prefers-reduced-motion:reduce){ .znt-ship,.znt-heart{ animation:none; } }
                .znt-body { padding:18px 20px 22px; }
                .znt-title { font-family:Georgia,"Times New Roman",serif; font-size:22px; font-weight:500; margin:0 0 8px; color:var(--ink); }
                .znt-intro { font-size:13.5px; line-height:1.6; color:var(--ink-2); margin:0 0 16px; }
                .znt-start { margin:0 0 10px; font-size:11px; color:var(--ink-3); letter-spacing:.05em; text-transform:uppercase; }
                .znt-chips { display:flex; flex-wrap:wrap; gap:8px; }
                .znt-chip { display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-family:inherit; color:var(--ink); background:var(--card); border:1px solid var(--hair); border-radius:11px; padding:7px 11px; cursor:pointer; transition:border-color .15s,background .15s,transform .06s; }
                .znt-chip:hover { border-color:var(--elig-ink); background:var(--elig-bg); }
                .znt-chip:active { transform:translateY(1px); }
              \`}</style>
              <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;600&display=swap" />
              <div className="znt-card">
                <div className="znt-hero">
                  <div className="znt-scene" aria-hidden>
                    <span className="znt-ship znt-ship-l">🚢</span>
                    <span className="znt-heart">❤️</span>
                    <span className="znt-ship znt-ship-r">🚢</span>
                  </div>
                  <p className="znt-ahoy">Vessel Tinder · Trafigura ⚓</p>
                </div>
                <div className="znt-body">
                  <h2 className="znt-title">Tired of dashboards?</h2>
                  <p className="znt-intro">
                    Meet <strong>Vessel Tinder</strong> — the only place your fleet swipes right on
                    compliance. Vessel profiles, breakups, and the occasional situationship we're
                    monitoring closely, all powered by live Trafigura emission data.
                  </p>
                  <p className="znt-start">Where shall we start?</p>
                  <div className="znt-chips">
                    {[
                      // Fleet-wide chips render in one click (no specific vessel needed).
                      { label: "Swipe the card", icon: "💘", prompt: "Swipe through vessel matches" },
                      { label: "Voyage match", icon: "🧭", prompt: "Find a voyage match" },
                      { label: "Who ghosted me?", icon: "👻", prompt: "Which vessels have ghosted me?" },
                      // Single-vessel chips carry a real demo IMO so the agent renders the
                      // widget immediately instead of asking "which vessel?" (knowledge doc note).
                      { label: "Recent breakup", icon: "💔", prompt: "Show me a recent breakup for Captain's Pride (IMO 9920760)" },
                      { label: "Flip card", icon: "🃏", prompt: "Show me a flip card for Methane Sapphire (IMO 9710022)" },
                      { label: "Love meter", icon: "❤️", prompt: "Show the love meter for Methane Sapphire (IMO 9710022) and Captain's Pride (IMO 9920760)" },
                      { label: "Get reports", icon: "⚖️", prompt: "Download the IMO DCS and MRV reports for Methane Sapphire (IMO 9710022)" },
                      { label: "File for divorce", icon: "📜", prompt: "Divorce Captain's Pride (IMO 9920760)" },
                    ].map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        className="znt-chip"
                        onClick={() => onSuggestionSelect?.(s.prompt)}
                      >
                        <span aria-hidden>{s.icon}</span> {s.label} →
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )`;

// ── Discovery ────────────────────────────────────────────────────────────────
// Bounded recursive search for every installed copy of message-list.tsx, plus
// any cached synthetic workspaces `zap serve` has built under $TMPDIR.
const DESCEND = /^(?:@0north|node_modules|\.pnpm|lib|packages|tools|image|node|versions|global|store|[0-9]+|v?\d+\.\d+|zap-.*|.*0north.*|.*zap.*)$/i;

const findUnder = (root, depth, out) => {
  if (depth < 0 || !existsSync(root)) return;
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(root, e.name);
    if (e.isFile()) continue;
    if (!e.isDirectory()) continue;
    // Fast path: does this dir directly contain the target relative file?
    const candidate = join(p, REL);
    if (existsSync(candidate)) out.add(candidate);
    if (DESCEND.test(e.name)) findUnder(p, depth - 1, out);
  }
};

const discover = () => {
  const out = new Set();
  const roots = [
    join(homedir(), ".volta", "tools", "image", "packages"),
    join(homedir(), ".nvm", "versions", "node"),
    join(homedir(), "Library", "pnpm", "global"),
    "/usr/local/lib/node_modules",
    "/usr/lib/node_modules",
  ];
  for (const r of roots) findUnder(r, 12, out);

  // Cached synthetic workspaces: $TMPDIR/zap-dev-*/packages/frontend/src/.../message-list.tsx
  const tmp = tmpdir();
  try {
    for (const name of readdirSync(tmp)) {
      if (!name.startsWith("zap-dev-")) continue;
      const f = join(tmp, name, "packages", "frontend", "src", "components", "chat", "message-list.tsx");
      if (existsSync(f)) out.add(f);
    }
  } catch {
    /* no tmp access — ignore */
  }
  return [...out];
};

// ── Splash interior replacement (paren-matched) ──────────────────────────────
const replaceSplash = (src) => {
  const at = src.indexOf(ANCHOR);
  if (at === -1) throw new Error(`anchor "${ANCHOR}" not found — frontend layout changed?`);
  // Position the cursor at the "(" that opens the JSX expression after `&&`.
  const open = at + ANCHOR.length - 1; // index of '('
  let depth = 0;
  let close = -1;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close === -1) throw new Error("could not find the matching ) for the splash block");
  return src.slice(0, open) + SPLASH + src.slice(close + 1);
};

// ── Run ──────────────────────────────────────────────────────────────────────
const files = discover();
if (files.length === 0) {
  console.error("No @0north/zap-frontend message-list.tsx found. Is the zap CLI installed?");
  process.exit(1);
}

let changed = 0;
for (const file of files) {
  const orig = file + ".znt-orig";
  const src = readFileSync(file, "utf8");

  if (mode === "check") {
    const state = src.includes(MARKER) ? "patched" : "stock";
    console.log(`  [${state}] ${file}`);
    continue;
  }

  if (mode === "restore") {
    if (existsSync(orig)) {
      writeFileSync(file, readFileSync(orig, "utf8"));
      console.log(`  restored ${file}`);
      changed++;
    } else {
      console.log(`  (no backup) ${file}`);
    }
    continue;
  }

  // patch
  if (!existsSync(orig)) writeFileSync(orig, src); // backup the stock file once
  try {
    const next = replaceSplash(src);
    if (next !== src) {
      writeFileSync(file, next);
      console.log(`  patched ${file}`);
      changed++;
    } else {
      console.log(`  unchanged ${file}`);
    }
  } catch (err) {
    console.error(`  FAILED ${file}: ${err.message}`);
    process.exitCode = 1;
  }
}

if (mode !== "check") {
  console.log(`\n${mode === "restore" ? "Restored" : "Patched"} ${changed} file(s).`);
  if (mode === "patch") console.log("Run `make serve` (or restart zap serve) to see the Vessel Tinder splash.");
}
