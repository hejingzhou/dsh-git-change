# dsh-git-tab

![icon](assets/icon-180.png)

一个 DeepSeek Harness（DSH）Web 界面插件：在**右侧栏**加入「Git 变更」页签，用于审查工作区改动、
浏览提交树，并在面板内一键提交（本地 / 提交并推送）和一键拉取。

## 功能

- **变更**：列出已修改（已暂存 / 未暂存）、新增、删除、重命名和**未跟踪**文件，带 `+新增 / −删除` 行数。
  选中文件即在下方渲染统一 diff（行号、hunk 头、增删着色）；未跟踪文件按整文件新增展示；
  二进制与超大文件有明确标注。
- **提交树**：用 Git 自身的 ASCII 拓扑绘制提交图（`git log --graph`），展示短 hash、
  refs（HEAD / 分支 / 远端分支 / tag）、提交说明与日期；合并提交的图线完整保留。
- **一键提交（本地 / 远程）**：点「提交」后选择 **仅本地提交** 或 **提交并推送**。
  仅本地 = `git add -A` + `git commit`；提交并推送 = 提交后 `git push`，工作区干净时改为推送已有本地提交，
  无上游时自动 `git push -u origin <branch>`。推送失败不会丢失本地提交，会提示「已本地提交 {hash}，但推送失败」。
- **一键拉取**：`git pull --ff-only`，只允许快进，不会自动生成 merge 提交；分叉、无上游、
  本地改动冲突等错误直接提示。
- **切换分支**：点击顶部当前分支名打开本地分支列表（含上游与「当前」标记），选择即切换。
  **仅当工作区完全干净时可用**——有已暂存、未暂存或未跟踪文件时按钮会拒绝并提示；
  Host 侧同样再次校验（`git status --porcelain` 非空即拒绝），避免绕过界面误切换。
- 刷新按钮、页签重新可见、窗口重新获得焦点时自动刷新；提交/拉取/切换分支成功后自动刷新。
- 跟随 DSH 明暗主题；文案走 DSH locale（中文 / English）。

## 安装

### 从 GitHub 安装（源码安装）

```sh
dsh plugin --profile web add github:hejingzhou/dsh-git-change
```

安装后在左侧栏「插件」页确认已启用，刷新 Web 页面；展开会话右侧栏，指南里点 **Git 变更** 即可。

### 从 npm 安装（发布后）

```sh
dsh plugin --profile web add dsh-git-tab
```

## 实现

- **Host 半侧**（`index.js`）：在 Web server 注册 7 个同源 JSON 路由——
  `GET /dsh-git-changes/status`、`GET /dsh-git-changes/diff`、`GET /dsh-git-changes/log`、
  `GET /dsh-git-changes/branches`、`POST /dsh-git-changes/switch`（`{ branch }`，工作区不干净时拒绝）、
  `POST /dsh-git-changes/commit`（`{ message, mode: 'local' | 'remote' }`）、
  `POST /dsh-git-changes/pull`。
  目录由 Session 记录的 `cwd` 决定（回退到部署默认目录），`git` 以参数数组执行、不经过 shell；
  只读命令设置 `GIT_OPTIONAL_LOCKS=0`，diff 不启用外部 diff / textconv；
  请求带自定义头 + 本机同源校验，所有文件路径校验为仓库相对路径。
- **Client 半侧**（`client.js`）：通过 `ctx.sidebarRightTabs` 注册 `git-changes` 页签类型和指南卡片，
  通过 `sidebar.right.pane.tab` / `.title` 插槽注册页签主体与标题；样式只用 `--dsw-alias-*` 主题 token。

## 目录

| 文件 | 说明 |
| --- | --- |
| `package.json` | bundle 清单：`dsh.bundle.patch`、`dsh.client`、展示资源导出 |
| `cordis.patch.yml` | 插入 Host 行 `git-changes` |
| `index.js` | Host 半侧：Git 只读路由 + 提交/拉取 |
| `client.js` | Client 半侧：页签类型、指南入口、变更视图、提交树、动作 |
| `locale/en.json`、`locale/zh.json` | 插件管理页标题与描述 |
| `icon.svg` / `assets/icon-180.png` | 插件图标（DSH 用 SVG，市场卡片用 PNG） |
| `docs/awesome-entry.yml` | 提交到 awesome-dsh-plugin 的收录条目 |
| `PUBLISHING.md` | 上架步骤（GitHub / npm / awesome 收录） |

## 限制

- 拉取仅快进；分叉分支请在终端处理。
- 切换分支要求工作区完全干净（含未跟踪文件）；Host 侧强制校验，界面提示先行拦截。
- 提交遵循仓库自身的 hooks 与 Git 用户身份；hook 失败或身份缺失会显示 Git 原文。
- ahead/behind 反映最近一次 fetch 的上游状态，拉取会刷新。
- 一键提交会暂存整个工作区（含未跟踪文件），请按需使用。

## License

[MIT](LICENSE)
