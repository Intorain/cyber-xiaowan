# 赛博小晚 · 桌宠模式

让小晚以真人表情包桌宠的形式住在你的桌面上：不同状态对应不同的动作、表情和一句话，Codex 与 DSH 的会话事件可以实时点亮她。

全部本地运行：零依赖（仅 Node 内置模块），服务只绑定 `127.0.0.1`，不上传任何数据。

## 快速开始

```bash
# 在仓库根目录
node pet/cli.mjs              # 启动桌宠（自动弹出窗口）
node pet/cli.mjs clap         # 让小晚鼓掌
node pet/cli.mjs clap "这步走得漂亮！"
node pet/cli.mjs sleep        # 让她打盹
```

也可以：

```bash
npm run pet
```

## 状态一览

| 状态 | 动作/表情 | 触发命令 | 说明 |
|---|---|---|---|
| `idle` | 😊 真人特写·呼吸 | `node pet/cli.mjs idle` | 默认状态，脸部特写 |
| `think` | 🤔 emoji·摇摆 | `node pet/cli.mjs think` | 思考中，暂用 emoji 兜底 |
| `work` | 💪 真人全景·镜像小跳 | `node pet/cli.mjs work` | 干活中，镜像画面 |
| `clap` | 👏 真人鼓掌（实拍原图） | `node pet/cli.mjs clap` | 庆祝，几秒后自动回落 |
| `question` | 🧐 真人特写·歪头 | `node pet/cli.mjs question` | 有疑问，自动回落 |
| `sleep` | 😴 真人全景·调暗冒泡 | `node pet/cli.mjs sleep` | 长时间无活动 |

六个状态中五个使用真人形象（同一张实拍的不同构图派生：特写、镜像、旋转、调色），图片态右下角会带对应状态的 emoji 徽标。

交互：拖动卡片移动位置（会记住）；单击切换状态；双击直接鼓掌。窗口以 Chrome/Edge 应用模式打开，没有这些浏览器时回退默认浏览器。

## 接入 Codex

Codex CLI 支持 `notify` 钩子。在 `~/.codex/config.toml` 中加一行（路径换成你的仓库实际位置）：

```toml
notify = ["node", "<repo>/pet/integrations/codex-notify.mjs"]
```

效果：Codex 每完成一轮回答，小晚就鼓一次掌；出错时歪头提问。桌宠没开时钩子静默退出，不影响 Codex。

## 接入 DSH

两种用法可以叠加：

1. **自动观察**（推荐常驻）：

   ```bash
   nohup node <repo>/pet/integrations/dsh-watch.mjs >/dev/null 2>&1 &
   ```

   它轮询本机 DSH 会话目录的写入时间：有会话在写 → `work`；安静 2 分钟 → `idle`；8 分钟 → `sleep`。

2. **Agent 主动触发**：DSH 里的 agent 都能跑 shell，直接让它执行即可。建议在你的 AGENTS.md / 预设里加一条约定，例如：

   ```text
   完成一个阶段性任务后运行：node <repo>/pet/cli.mjs clap
   开始长任务前运行：node <repo>/pet/cli.mjs work
   ```

## HTTP API

服务只监听回环地址，端口写在 `~/.cyber-xiaowan/pet.json`。

```bash
curl http://127.0.0.1:PORT/api/state          # 查询当前状态
curl -X POST -H 'content-type: application/json' \
     -d '{"state":"clap","note":"自定义台词"}' \
     http://127.0.0.1:PORT/api/state           # 切换状态
curl -N http://127.0.0.1:PORT/api/events      # SSE 实时订阅
```

## 添加更多真人表情包素材

当前内置素材全部来自一张「鼓掌」实拍原图：`clap.jpg` 是原图，`idle.jpg`（特写）、`work.jpg`（镜像）、`question.jpg`（旋转歪头）、`sleep.jpg`（去饱和调暗）是它的派生构图。补充你自己的素材：

1. 把图片放进 `pet/assets/`（建议 700px 宽以内，jpg/png 均可）。
2. 在 `pet/pets.json` 里给对应状态的 `"image"` 字段填上相对路径（如 `"assets/think.jpg"`）；`"image"` 为空时该状态使用 emoji 形象兜底。
3. 保存后刷新桌宠窗口即可生效，无需重启服务。

不同动作的实拍照片（思考、打字、睡觉、比心等）替换掉派生图后效果最好——派生图只是让框架开箱即用。

素材版权与肖像：请只使用你有权使用的图片。内置素材来自赛博小晚项目作者本人的照片，仅作示例用途；若你合并此 PR 后希望替换或移除，改 `pet/assets/` 或删除对应引用即可。

## 文件结构

```text
pet/
├── cli.mjs                    # 入口：启动服务 / 触发状态
├── server.mjs                 # 本地 HTTP 服务（静态文件 + 状态 API + SSE）
├── pets.json                  # 状态清单：贴图、动画、台词、是否自动回落
├── public/index.html          # 桌宠界面（拖拽 / 点击 / 动画）
├── assets/                    # 真人表情包素材
│   ├── clap.jpg               # 「鼓掌」实拍原图（庆祝态）
│   ├── idle.jpg               # 头部特写（待机）
│   ├── work.jpg               # 镜像全景（干活）
│   ├── question.jpg           # 旋转歪头特写（疑问）
│   └── sleep.jpg              # 去饱和调暗（打盹）
└── integrations/
    ├── codex-notify.mjs       # Codex CLI notify 钩子桥
    └── dsh-watch.mjs          # DSH 会话活动观察器
```
