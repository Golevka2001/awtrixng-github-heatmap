// Offline tests for the pure computation functions.  Run with `node test.mjs`.
//
// Imports directly from src/index.js — no drift risk.
//
// What is NOT covered here (needs a live GitHub token + wrangler dev):
//   - The GraphQL fetch and error paths
//   - Real contribution data → grid correctness

const mod = await import(new URL("./src/index.js", import.meta.url));
const { monthHue, hsvToPacked, buildColumn, buildGrid } = mod;

let failed = 0;
function eq(name, got, want) {
  if (String(got) !== String(want)) {
    failed++;
    console.log(`  FAIL ${name}: got ${got}, want ${want}`);
  } else {
    console.log(`  ok   ${name}`);
  }
}

// --- monthHue --------------------------------------------------------------

console.log("monthHue");
eq("jan=0", monthHue(1), 0);
eq("apr=90", monthHue(4), 90);
eq("jul=180", monthHue(7), 180);
eq("oct=270", monthHue(10), 270);
eq("dec=330", monthHue(12), 330);

// --- hsvToPacked -----------------------------------------------------------

console.log("hsvToPacked");
eq("red", hsvToPacked(0, 100, 100), 0xff0000);
eq("green", hsvToPacked(120, 100, 100), 0x00ff00);
eq("blue", hsvToPacked(240, 100, 100), 0x0000ff);
eq("black", hsvToPacked(0, 0, 0), 0x000000);
eq("white", hsvToPacked(0, 0, 100), 0xffffff);

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

// Rainbow month marker: row 0 gets the month's hue instead of grey
const col3 = buildColumn([{ date: "2026-08-01", level: 1 }], true);
eq("rainbow marker row 0", col3[0] !== 0, true);
eq("rainbow marker is not grey", col3[0] !== 0x666666, true);
eq("rainbow off is grey", buildColumn([{ date: "2026-08-01", level: 1 }], false)[0], 0x666666);

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

// Rainbow months: the painted 32 weeks span several month starts, so at
// least one pixel must be neither background, level green, nor grey marker
const isPalette = (v) =>
  v === 0 || v === 0x666666 || [0x161b22, 0x0e4429, 0x006d32, 0x26a641, 0x39d353].includes(v);
const g365r = buildGrid(days365, { rainbow: true });
eq("rainbow grid length", g365r.length, 256);
eq("rainbow marker present", g365r.some((v) => !isPalette(v)), true);
eq("rainbow off stays palette", buildGrid(days365, { rainbow: false }).every(isPalette), true);

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
