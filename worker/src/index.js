// GitHub contribution heatmap for AWTRIX NG.
//
// GET /?user=<github_username>[&rainbow=0]
//
// Returns a flat JSON array of 256 packed 0xRRGGBB integers (32x8, row-major)
// ready for the Berry app to paint pixel-by-pixel.
//
// The worker holds no state between requests.  Caching is left to the caller
// (the Berry app fetches at most once per configured interval).

const GITHUB_GRAPHQL = "https://api.github.com/graphql";

const LEVEL_COLORS = [
  0x161b22, // level 0 – no contributions (GitHub dark bg)
  0x0e4429, // level 1
  0x006d32, // level 2
  0x26a641, // level 3
  0x39d353, // level 4
];

const LEVEL_MAP = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

const PANEL_W = 32;
const PANEL_H = 8;
const MONTH_MARKER = 0x666666;

export default {
  async fetch(request, env) {
    let out;
    try {
      out = await handle(request, env);
    } catch (err) {
      out = json({ error: "internal", detail: String(err && err.message) }, 500);
    }
    return out;
  },
};

async function handle(request, env) {
  const q = new URL(request.url).searchParams;
  const user = request.headers.get("X-User") || q.get("user");
  const rainbow = (request.headers.get("X-Rainbow") || q.get("rainbow") || "1") !== "0";

  console.log("request", { user, rainbow });

  if (!user) return json({ error: "missing user" }, 400);

  // env.GITHUB_TOKEN: set via .dev.vars (local) or wrangler secret (deployed)
  const token = env && env.GITHUB_TOKEN;
  if (!token) return json({ error: "GITHUB_TOKEN not configured" }, 500);

  // --- fetch contribution data from GitHub -----------------------------------

  const query = `query($user: String!) {
    user(login: $user) {
      contributionsCollection {
        contributionCalendar {
          weeks {
            contributionDays {
              date
              contributionLevel
            }
          }
        }
      }
    }
  }`;

  const gh = await fetch(GITHUB_GRAPHQL, {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "awtrixng-github-heatmap-worker",
    },
    body: JSON.stringify({ query, variables: { user } }),
  });

  if (!gh.ok) {
    const text = await gh.text();
    return json({ error: "github api", status: gh.status, detail: text.slice(0, 200) }, 502);
  }

  const data = await gh.json();
  const cal =
    data &&
    data.data &&
    data.data.user &&
    data.data.user.contributionsCollection &&
    data.data.user.contributionsCollection.contributionCalendar;

  if (!cal || !cal.weeks) {
    return json({ error: "unexpected github response" }, 502);
  }

  // --- flatten days ---------------------------------------------------------

  const days = [];
  for (const week of cal.weeks) {
    for (const d of week.contributionDays) {
      days.push({
        date: d.date,
        level: LEVEL_MAP[d.contributionLevel] ?? 0,
      });
    }
  }

  if (days.length === 0) {
    return json({ error: "no contribution data" }, 502);
  }

  console.log("github response", { user, days: days.length });
  return json(buildGrid(days, { rainbow }));
}

// ---------------------------------------------------------------------------
// Pure computation — exported for testing.
// ---------------------------------------------------------------------------

// Rainbow months: each month's marker gets a fixed hue on the color wheel,
// so adjacent months are visually distinct at a glance.
export function monthHue(month) {
  return ((month - 1) / 12) * 360;
}

export function hsvToPacked(h, s, v) {
  s /= 100;
  v /= 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r, g, b;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return (Math.round((r + m) * 255) << 16) |
         (Math.round((g + m) * 255) << 8) |
          Math.round((b + m) * 255);
}

export function buildColumn(dayList, rainbow) {
  const col = new Array(PANEL_H).fill(0);
  let markerSet = false;
  for (const d of dayList) {
    const dt = typeof d.date === "string" ? new Date(d.date + "T00:00:00Z") : d.date;
    // row: Sun=1 Mon=2 ... Sat=7
    const row = dt.getUTCDay() + 1;
    if (row >= 1 && row < PANEL_H) {
      col[row] = LEVEL_COLORS[d.level] ?? LEVEL_COLORS[4];
    }
    if (!markerSet && dt.getUTCDate() === 1) {
      col[0] = rainbow
        ? hsvToPacked(monthHue(dt.getUTCMonth() + 1), 70, 70)
        : MONTH_MARKER;
      markerSet = true;
    }
  }
  return col;
}

export function buildGrid(days, { rainbow = true } = {}) {
  const lastDate = new Date(days[days.length - 1].date + "T00:00:00Z");
  const lastDow = lastDate.getUTCDay();
  const daysFromSat = (6 - lastDow + 7) % 7;
  const anchorDate = new Date(lastDate);
  anchorDate.setUTCDate(anchorDate.getUTCDate() + daysFromSat);

  // group days by week index (0 = most recent week, counting back)
  const weekMap = new Map();
  for (const d of days) {
    const dt = new Date(d.date + "T00:00:00Z");
    const diffDays = Math.round((anchorDate - dt) / 86400000);
    const weekIdx = Math.floor(diffDays / 7);
    if (!weekMap.has(weekIdx)) weekMap.set(weekIdx, []);
    weekMap.get(weekIdx).push({ date: dt, level: d.level });
  }

  const maxWeek = Math.max(...weekMap.keys());
  const columns = [];
  for (let wi = 0; wi <= maxWeek; wi++) {
    const daysInWeek = weekMap.get(wi);
    if (!daysInWeek || daysInWeek.length === 0) {
      columns.push(new Array(PANEL_H).fill(0));
    } else {
      columns.push(buildColumn(daysInWeek, rainbow));
    }
  }

  // flatten to 256 pixels (row-major, right-aligned)
  const pixels = new Array(PANEL_W * PANEL_H).fill(0);
  const colCount = Math.min(columns.length, PANEL_W);

  for (let c = 0; c < colCount; c++) {
    const targetCol = PANEL_W - 1 - c;
    const col = columns[c];
    for (let row = 0; row < PANEL_H; row++) {
      pixels[targetCol * PANEL_H + row] = col[row];
    }
  }

  return pixels;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
