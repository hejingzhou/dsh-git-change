# 发布与收录步骤（dsh-git-tab / hejingzhou/dsh-git-change）

本文件记录把这个插件推到公开 GitHub 仓库、发布 npm 包、并提交到
[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 收录仓库的完整步骤。
收录规则以官方 [contributing.md](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md) 为准。

- GitHub 仓库：<https://github.com/hejingzhou/dsh-git-change>（public，main）
- npm 包名（可选发布）：`dsh-git-tab`
- 收录条目「name」使用 `owner/repo`：`hejingzhou/dsh-git-change`

## 一、硬性条件（收录 CI 会检查）

| 条件 | 本插件状态 |
| --- | --- |
| 公开 GitHub 仓库 | 已建并推送：`hejingzhou/dsh-git-change` |
| 仓库 `package.json` 声明 `dsh.bundle` | 已满足（`dsh.bundle.patch: ./cordis.patch.yml`） |
| `cordis.patch.yml` 与宿主行 | 已满足（`id: git-changes`，`name: dsh-git-tab`） |
| 仓库创建满 1 天 | 仓库创建于 2026-11-03 16:42（北京时间），**次日 16:42 后**才满足 |
| 仓库带 `dsh-plugin` topic | 已添加 |
| 真实可用代码 | 已满足 |
| 每个 PR 最多 3 条条目 | 本插件 1 条 |

## 二、提交收录 PR

1. Fork [awesome-dsh-plugin/awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)。
2. 把本仓库 [docs/awesome-entry.yml](docs/awesome-entry.yml) 的内容保存为
   `data/plugins/hejingzhou__dsh-git-change.yml`（文件名规则 `<owner>__<repo>.yml`）。
3. 只添加这一个文件，提交 PR。标题建议：

   ```text
   Add dsh-git-change
   ```

   PR 正文建议：

   ```text
   Adds dsh-git-change, a right-sidebar Git tab for DeepSeek Harness:
   working-tree changes with inline diffs, the commit graph, commit
   (local or commit & push), and fast-forward pull.

   Repo: https://github.com/hejingzhou/dsh-git-change
   Every install/behaviour claim in the entry description is implemented
   in package.json + cordis.patch.yml + index.js + client.js.
   ```

4. CI 依次检查：条目数量 → 从仓库 `package.json` 读取 `dsh.bundle` → 仓库年龄 → awesome-lint/构建。
   失败会给出具体原因；仓库年龄不足时结论是快照，达标后会自动重跑，无需推空提交。
5. 维护者可能打 `held: author` 标签要求修改描述；改完推同一分支并留一条说明评论。

## 三、可选：发布 npm 包（可让市场显示下载量）

npm 包不是收录必需项。`dsh-git-tab` 在 2026-11-03 检查时仍可注册。

```powershell
npm login
npm publish --access public
```

要求：`package.json` 的 `repository` 必须指回收录的 GitHub 仓库（已配置为
`https://github.com/hejingzhou/dsh-git-change`）。npm 读取 `files` 白名单发布；
本包无依赖、无构建脚本，`pnpm pack` 已验证内容为 10 个文件、约 32 KB。

## 四、可选：GitHub Release tarball

若希望市场提供预构建包，可在 GitHub Release 附加 `npm pack` 产物：

```powershell
npm pack
# 上传 dsh-git-tab-1.0.0.tgz 到 GitHub Release
```

条目里再加一行（`latest/download/` 的文件名不要带版本号）：

```yaml
tarball: https://github.com/hejingzhou/dsh-git-change/releases/latest/download/dsh-git-tab.tgz
```

本插件没有构建步骤与安装脚本，源码安装即可用，tarball 属于可选项。

## 五、本地开发与更新

本机 profile 通过 `link:D:\kdyhis_ai\plugins\dsh-git-changes` 安装（开发模式），
改完代码后：Host 半侧需要重载插件（插件管理页关/开 bundle），Client 半侧刷新页面。
发布新版本后 GitHub 仓库与本地仓库是同一份工作目录，直接 `git push` 即可。
