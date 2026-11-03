# 发布与收录步骤（dsh-git-tab）

本文件记录把这个插件推到公开 GitHub 仓库、发布 npm 包、并提交到
[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 收录仓库的完整步骤。
收录规则以官方 [contributing.md](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md) 为准。

## 一、硬性条件（收录 CI 会检查）

| 条件 | 本插件状态 |
| --- | --- |
| 公开 GitHub 仓库 | 需创建 |
| 仓库 `package.json` 声明 `dsh.bundle` | 已满足（`dsh.bundle.patch: ./cordis.patch.yml`） |
| `cordis.patch.yml` 与宿主行 | 已满足（`id: git-changes`，`name: dsh-git-tab`） |
| 仓库创建满 1 天 | 建仓后等 1 天再提 PR（CI 自动检查） |
| 仓库带 `dsh-plugin` topic | 建仓后在仓库 Settings / About 里添加 |
| 真实可用代码 | 已满足 |
| 每个 PR 最多 3 条条目 | 本插件 1 条 |

## 二、创建并推送 GitHub 仓库

```powershell
# 在插件目录内（本目录已初始化为独立 git 仓库）
cd D:\kdyhis_ai\plugins\dsh-git-changes
git remote add origin https://github.com/hejingzhou/dsh-git-tab.git
git push -u origin main
```

如果本地还没有仓库，先在 GitHub 新建空仓库 `hejingzhou/dsh-git-tab`（不要勾选 README），
然后执行上面的 `git remote add` / `git push`。

## 三、添加 `dsh-plugin` topic

GitHub 仓库页 → 右侧 About 齿轮 → Topics 添加 `dsh-plugin`（必须）。

## 四、提交收录 PR

1. Fork [awesome-dsh-plugin/awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)。
2. 从 `docs/awesome-entry.yml` 复制内容为
   `data/plugins/hejingzhou__dsh-git-tab.yml`（文件名规则 `<owner>__<repo>.yml`）。
3. 只添加这一个文件，提交 PR。建议标题：

   ```text
   Add dsh-git-tab
   ```

4. CI 会依次检查：条目数量 → 从仓库 `package.json` 读取 `dsh.bundle` → 仓库年龄 → awesome-lint/构建。
   失败会给出具体原因，直接在同一分支修复并推送即可。
5. 维护者可能打 `held: author` 标签要求修改描述；改完推同一分支并留一条说明评论。

收录条目内容见 [docs/awesome-entry.yml](docs/awesome-entry.yml)。

## 五、可选：发布 npm 包（可让市场显示下载量）

npm 包不是收录必需项，但推荐。`dsh-git-tab` 2026-11-03 检查时仍可注册。

```powershell
npm login
npm publish --access public
```

要求：`package.json` 的 `repository` 必须指回收录的 GitHub 仓库（已配置）；
npm 会读取 `files` 白名单发布（已配置），本包无依赖、无构建脚本。

## 六、可选：GitHub Release tarball

若担心用户从源码安装时的构建授权，可在 GitHub Release 附加预构建 tarball：

```powershell
npm pack
# 上传 dsh-git-tab-1.0.0.tgz 到 GitHub Release
```

条目里再加一行（`latest/download/` 的文件名不要带版本号）：

```yaml
tarball: https://github.com/hejingzhou/dsh-git-tab/releases/latest/download/dsh-git-tab.tgz
```

本插件没有构建步骤与安装脚本，源码安装即可用，tarball 属于可选项。

## 七、发布后本地更新

npm 发布或 GitHub 推送新版本后，本机 profile 里的链接安装仍是工作目录，无需重装；
若改了 `package.json` 名字或把目录移走，用插件管理页重新安装即可。
