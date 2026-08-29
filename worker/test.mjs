// Offline tests for the pure computation functions.  Run with `node test.mjs`.
//
// Imports directly from src/index.js — no drift risk.
//
// What is NOT covered here (needs a live GitHub token + wrangler dev):
//   - The GraphQL fetch and error paths
//   - Real contribution data → grid correctness

const mod = await import(new URL("./src/index.js", import.meta.url));
const { buildColumn, buildGrid } = mod;

let failed = 0;
function eq(name, got, want) {
  if (String(got) !== String(want)) {
    failed++;
    console.log(`  FAIL ${name}: got ${got}, want ${want}`);
  } else {
    console.log(`  ok   ${name}`);
  }
}

// --- buildColumn -----------------------------------------------------------

console.log("buildColumn");
// A single day at level 2 (2026-08-12 is a Wednesday → row 4)
const col1 = buildColumn([{ date: "2026-08-12", level: 2 }]);
eq("col length", col1.length, 8);
eq("row 0 empty", col1[0], 0);
eq("wednesday set", col1[4], 0x006d32);
eq("other row", col1[1], 0);

// Month marker: 2026-08-01 is a Saturday → row 7, marker at row 0, grey
const col2 = buildColumn([{ date: "2026-08-01", level: 1 }]);
eq("marker row 0", col2[0], 0x666666);
eq("saturday level kept", col2[7], 0x0e4429);

// --- buildGrid -------------------------------------------------------------

console.log("buildGrid");
// Minimal: 7 days in one week
const days7 = [];
for (let i = 0; i < 7; i++) {
  const d = new Date("2026-08-09T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + i);
  days7.push({ date: d.toISOString().slice(0, 10), level: (i % 5) });
}
const g7 = buildGrid(days7);
eq("grid length", g7.length, 256);
eq("has pixels", g7.some((v) => v !== 0), true);

// The newest week is column 31, matching the legacy Python renderer.
const daysTwoWeeks = [
  { date: "2026-08-08", level: 1 },
  { date: "2026-08-10", level: 4 },
];
const gTwoWeeks = buildGrid(daysTwoWeeks);
eq("old week is left of newest", gTwoWeeks[30 * 8 + 7], 0x0e4429);
eq("newest week is rightmost", gTwoWeeks[31 * 8 + 2], 0x39d353);

// Full year: 365 days → should still produce 256 pixels
const days365 = [];
for (let i = 0; i < 365; i++) {
  const d = new Date("2025-08-15T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + i);
  days365.push({ date: d.toISOString().slice(0, 10), level: i % 5 });
}
const g365 = buildGrid(days365);
eq("365-day grid length", g365.length, 256);
eq("365-day has pixels", g365.some((v) => v !== 0), true);

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
