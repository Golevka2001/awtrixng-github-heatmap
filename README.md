# awtrixng-github-heatmap

![preview](./README.assets/preview.gif)

A GitHub contribution heatmap for AWTRIX NG, rendered on the 32×8 LED panel.

```plaintext
AWTRIX app ──▶ Cloudflare Worker ──GraphQL──▶ GitHub API
    ▲                 │
    └── 256 pixels ◀──┘    JSON array of 0xRRGGBB ints, 32×8 row-major
```

| File                | Role                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| `github-heatmap.ax` | AWTRIX NG custom app (Berry): fetches the worker on an interval and paints the response                    |
| `worker/`           | Cloudflare Worker: queries the GitHub GraphQL contribution calendar and renders it as the JSON array above |

Rendering conventions: the panel shows the last 32 weeks; rows 1–7 map Sunday through Saturday, the rightmost column is the current week, and row 0 carries the month marker. With Show Avatar on, the leftmost 8 columns render the user's 8×8 avatar.

## 1. Create a GitHub token

The worker only reads public data, so a classic **personal access token** with the `read:user` scope is all it needs.

1. Create one at <https://github.com/settings/tokens/new>.
2. Name it and tick `read:user`.
3. Generate and store it somewhere safe. You will need it in step 2.

## 2. Deploy the worker

This needs a Cloudflare account and wrangler installed.

```sh
cd worker
wrangler secret put GITHUB_TOKEN  # paste the token from step 1
wrangler deploy
```

You will see a URL like <https://awtrixng-github-heatmap-worker.xxx.workers.dev>. Test it with your GitHub username:

```sh
curl "https://awtrixng-github-heatmap-worker.xxx.workers.dev/?user=<github-username>"
# [0,934953,27954,934953,...]  exactly 256 integers
```

You can also bind the worker to a custom domain instead of `*.workers.dev`.

## 3. (Optional) Protect the worker with Cloudflare Access

Left open, anyone with the URL can query arbitrary accounts and burn your API quota. Access control is recommended.

1. **Create a new service token:** `Zero Trust - Access Controls - Service Credentials - Create Service Token`.
   Note the Client ID and Client Secret (the secret is shown only once).
2. **Create a new Access policy:** `Zero Trust - Access Controls - Policies - Add a Policy`.
   - Include = Service Token - the token created above
   - Action = Service Auth
3. **Add an application:** `Zero Trust - Access Controls - Applications - Add an Application - Self-hosted - Workers`.
   - Destinations/Workers/Scope = awtrixng-github-heatmap-worker
   - Access Policies = the policy created above

Test the worker again, you will see the Cloudflare Access error page:

```sh
curl "https://<worker-url>/?user=<github-username>"
# <!doctype html>
# <html>
#   <head>
#     <title>Error ・ Cloudflare Access</title>
# ...
```

You need to pass the service token in the `CF-Access-Client-Id` and `CF-Access-Client-Secret` headers:

```sh
curl "https://<worker-url>/?user=<github-username>" \
     -H "CF-Access-Client-Id: <client-id>" \
     -H "CF-Access-Client-Secret: <client-secret>"
# [0,934953,27954,934953,...]  exactly 256 integers
```

## 4. Install and configure the app

The app is published on [AWTRIX Flows](https://flows.blueforcer.de/flow/fxaGdh4z8w5m) — install it from there, or visit the AWTRIX NG web interface, go to **Scripts** and paste `github-heatmap.ax` into a new script. Configure it with the following settings:

| Setting                                 | Value                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------- |
| Server URL                              | The worker URL from step 2                                                |
| Username                                | GitHub username                                                           |
| (optional) CF Access Client ID / Secret | The service token from step 3. Leave empty if not using Cloudflare Access |
| Rainbow Months                          | Color the month markers with a per-month hue; on by default               |
| Split by Month                          | Add a gap between months; off by default                                  |
| Show Avatar                             | Render the user's 8×8 avatar in the leftmost columns; off by default      |
| Avatar Contrast                         | Contrast boost for the avatar, 1–3; default 1                             |
| Refresh                                 | Refresh interval in minutes                                               |

Behavior notes: the **select** button forces an immediate refresh; failed requests back off exponentially starting at 30 s, capped at `every`.
