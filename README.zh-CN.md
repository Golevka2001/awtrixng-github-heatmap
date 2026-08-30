# awtrixng-github-heatmap

[English](README.md) | 简体中文

![preview](./README.assets/preview.gif)

一个 AWTRIX-NG App：将你的 GitHub 贡献日历显示在渲染在像素钟上。

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Golevka2001/awtrixng-github-heatmap/tree/main/worker)

```plaintext
AWTRIX app ──▶ Cloudflare Worker ──GraphQL──▶ GitHub API
    ▲                 │
    └── 256 pixels ◀──┘    JSON array of 0xRRGGBB ints, 32×8 row-major
```

| 文件                | 作用                                                                    |
| ------------------- | ----------------------------------------------------------------------- |
| `github-heatmap.ax` | AWTRIX-NG App（Berry 脚本）：按设定间隔拉取 worker 的响应并逐像素绘制   |
| `worker/`           | Cloudflare Worker：查询 GitHub GraphQL 贡献日历，渲染成上面的 JSON 数组 |

面板显示最近 32 周；第 1–7 行对应周日到周六，最右一列是当前周，第 0 行是月份标记。开启 Show Avatar 后，最左侧 8 列显示用户的 8×8 头像。

## 1. 创建 GitHub token

worker 只读取公开数据，所以需要创建一个勾选了 `read:user` 的 **classic personal access token**。

1. 在 <https://github.com/settings/tokens/new> 创建。
2. 填个名字，勾选 `read:user`。
3. 生成，妥善保存一下，第 2 步会用到。

## 2. 部署 worker

### （推荐）一键部署

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Golevka2001/awtrixng-github-heatmap/tree/main/worker)

点击这个按钮即可部署 worker。

添加名为 `GITHUB_TOKEN` 的 secret，并粘贴第 1 步生成的 token。

### 手动部署

如果想手动部署，需要克隆仓库并安装 [wrangler](https://developers.cloudflare.com/workers/wrangler/)：

```sh
cd worker
wrangler secret put GITHUB_TOKEN  # 粘贴第 1 步生成的 token
wrangler deploy
```

部署完成后会得到一个形如 <https://awtrixng-github-heatmap-worker.xxx.workers.dev> 的 URL。用你的 GitHub 用户名测试：

```sh
curl "https://awtrixng-github-heatmap-worker.xxx.workers.dev/?user=<github-username>"
# [0,934953,27954,934953,...]  恰好 256 个整数
```

也可以把 worker 绑定到自定义域名，代替 `*.workers.dev`。

## 3. （可选）用 Cloudflare Access 保护 worker

如果不加访问控制，任何拿到 URL 的人都能查询任意账号，消耗你的 API 配额，建议开启。

1. **创建 Service Token：** `Zero Trust - Access Controls - Service Credentials - Create Service Token`。
   记下 Client ID 和 Client Secret（secret 只显示一次）。
2. **创建 Access Policy：** `Zero Trust - Access Controls - Policies - Add a Policy`。
   - Include = Service Token - 选择上面创建的 Service Token
   - Action = Service Auth
3. **添加应用：** `Zero Trust - Access Controls - Applications - Add an Application - Self-hosted - Workers`。
   - Destinations/Workers/Scope = awtrixng-github-heatmap-worker
   - Access Policies = 上面创建的策略

再次测试 worker，会看到 Cloudflare Access 的报错页面：

```sh
curl "https://<worker-url>/?user=<github-username>"
# <!doctype html>
# <html>
#   <head>
#     <title>Error ・ Cloudflare Access</title>
# ...
```

请求时需要带上 `CF-Access-Client-Id` 和 `CF-Access-Client-Secret` 两个请求头：

```sh
curl "https://<worker-url>/?user=<github-username>" \
     -H "CF-Access-Client-Id: <client-id>" \
     -H "CF-Access-Client-Secret: <client-secret>"
# [0,934953,27954,934953,...]  恰好 256 个整数
```

## 4. 安装并配置应用

应用已发布在 [AWTRIX Flows](https://flows.blueforcer.de/flow/fxaGdh4z8w5m)，从那里安装即可；也可以打开 AWTRIX NG 的网页界面，进入 **Scripts**，把 `github-heatmap.ax` 粘贴到新脚本中。按下表配置（设置项名称以应用界面上的英文标签为准）：

| 设置                                 | 值                                                       |
| ------------------------------------ | -------------------------------------------------------- |
| Server URL                           | 第 2 步得到的 worker URL                                 |
| Username                             | GitHub 用户名                                            |
| （可选）CF Access Client ID / Secret | 第 3 步的 Service Token；未启用 Cloudflare Access 就留空 |
| Rainbow Months                       | 用彩虹色显示月份标记；默认开启                           |
| Split by Month                       | 在月份之间留出空隙；默认关闭                             |
| Show Avatar                          | 在最左侧几列渲染用户的 8×8 头像；默认关闭                |
| Avatar Contrast                      | 头像对比度增强，1–3；默认 1                              |
| Refresh                              | 刷新间隔（分钟）                                         |

行为说明：**select** 按钮会立即强制刷新一次；请求失败后从 30 秒起指数退避，上限为 `Refresh` 设定的间隔；首次拉取成功前面板显示 `...`，一旦有失败的请求就会变成橙色的 `?`。
