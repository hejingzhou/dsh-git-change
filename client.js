window.__ModuleLoader__.load({
  id: 'dsh-git-tab',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Same-origin JSON surface served by this bundle's Host half. */
    const BASE = '/dsh-git-changes'
    const TOKEN_HEADER = 'x-dsh-git-changes'
    const NS = 'gitChanges'
    const ID = 'dsh-git-tab'
    const KIND = 'git-changes'
    /** Refuse to build an unbounded DOM for a huge diff. */
    const MAX_RENDER_ROWS = 4000
    const LOG_LIMIT = 150
    const NOTICE_TIMEOUT_MS = 8000

    const CSS = [
      '.gitc-root{display:flex;flex-direction:column;height:100%;min-height:0;box-sizing:border-box;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.45;overflow:hidden}',
      '.gitc-top{flex:none;display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:.5px solid var(--dsw-alias-border-l1)}',
      '.gitc-branch{display:flex;align-items:center;gap:6px;min-width:0;flex:1 1 auto;font-weight:600}',
      '.gitc-branch-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.gitc-summary{flex:none;color:var(--dsw-alias-label-secondary);font-size:11px;font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.gitc-refresh{flex:none;margin-left:auto;border:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);border-radius:6px;padding:2px 9px;font:inherit;font-size:11px;line-height:1.7;cursor:pointer}',
      '.gitc-refresh:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.gitc-refresh:disabled{opacity:.55;cursor:default}',
      '.gitc-toolbar{flex:none;display:flex;align-items:center;gap:8px;padding:6px 12px;border-bottom:.5px solid var(--dsw-alias-border-l1)}',
      '.gitc-switch{display:flex;gap:2px;padding:2px;border-radius:7px;background:var(--dsw-alias-bg-layer-2)}',
      '.gitc-switch button{border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;line-height:1.6;padding:2px 9px;border-radius:5px;cursor:pointer}',
      '.gitc-switch button[aria-selected="true"]{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}',
      '.gitc-pull{margin-left:auto;flex:none;border:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);border-radius:6px;padding:2px 9px;font:inherit;font-size:11px;line-height:1.7;cursor:pointer}',
      '.gitc-pull:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.gitc-pull:disabled{opacity:.55;cursor:default}',
      '.gitc-commit{flex:none;display:flex;align-items:center;gap:6px;padding:6px 12px;border-bottom:.5px solid var(--dsw-alias-border-l1)}',
      '.gitc-input{flex:1 1 auto;min-width:0;box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:6px;padding:3px 8px;font:inherit;font-size:12px;line-height:1.6;outline:none}',
      '.gitc-input:focus{border-color:var(--dsw-alias-brand-primary)}',
      '.gitc-input::placeholder{color:var(--dsw-alias-label-secondary)}',
      '.gitc-notice{flex:none;padding:6px 12px;font-size:11px;line-height:1.5;border-bottom:.5px solid var(--dsw-alias-border-l1);white-space:pre-wrap;word-break:break-word}',
      '.gitc-notice-ok{color:var(--dsw-alias-state-success-primary)}',
      '.gitc-notice-error{color:var(--dsw-alias-state-error-primary)}',
      '.gitc-choice{flex:none;display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:6px 12px;border-bottom:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);font-size:11px;color:var(--dsw-alias-label-secondary)}',
      '.gitc-choice-label{flex:none}',
      '.gitc-choice-btn{border:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:5px;padding:2px 8px;font:inherit;font-size:11px;line-height:1.6;cursor:pointer}',
      '.gitc-choice-btn:hover{background:var(--dsw-alias-bg-layer-1)}',
      '.gitc-choice-btn:disabled{opacity:.55;cursor:default}',
      '.gitc-choice-primary{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}',
      '.gitc-list{flex:0 1 auto;max-height:42%;min-height:56px;overflow:auto;padding:4px 0;border-bottom:.5px solid var(--dsw-alias-border-l1)}',
      '.gitc-row{display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;padding:5px 12px;border:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}',
      '.gitc-row:hover{background:var(--dsw-alias-bg-layer-1)}',
      '.gitc-row[aria-pressed="true"]{background:var(--dsw-alias-bg-layer-2)}',
      '.gitc-badge{flex:none;width:16px;height:16px;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;line-height:1}',
      '.gitc-badge-mod{color:var(--dsw-alias-state-warn-primary);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 15%,transparent)}',
      '.gitc-badge-add{color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 15%,transparent)}',
      '.gitc-badge-del{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 15%,transparent)}',
      '.gitc-badge-ren{color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 15%,transparent)}',
      '.gitc-badge-unm{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 22%,transparent)}',
      '.gitc-badge-unt{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2)}',
      '.gitc-path{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}',
      '.gitc-counts{flex:none;display:flex;gap:6px;font-size:11px;font-variant-numeric:tabular-nums}',
      '.gitc-add{color:var(--dsw-alias-state-success-primary)}',
      '.gitc-del{color:var(--dsw-alias-state-error-primary)}',
      '.gitc-diff{flex:1 1 auto;min-height:0;display:flex;flex-direction:column}',
      '.gitc-diff-head{flex:none;display:flex;align-items:center;gap:8px;padding:6px 12px;background:var(--dsw-alias-bg-layer-1);border-bottom:.5px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font-size:11px}',
      '.gitc-diff-path{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1 1 auto;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}',
      '.gitc-tag{flex:none;border:.5px solid var(--dsw-alias-border-l1);border-radius:4px;padding:0 5px;font-size:10px;color:var(--dsw-alias-label-secondary)}',
      '.gitc-lines{flex:1 1 auto;min-height:0;overflow:auto;font-family:ui-monospace,SFMono-Regular,Consolas,"Cascadia Mono",monospace;font-size:12px;line-height:1.55}',
      '.gitc-line{display:flex;width:max-content;min-width:100%;box-sizing:border-box;padding-right:12px}',
      '.gitc-num{flex:none;width:46px;padding:0 6px;text-align:right;color:var(--dsw-alias-state-idle-primary);user-select:none;font-variant-numeric:tabular-nums}',
      '.gitc-sign{flex:none;width:14px;text-align:center;user-select:none;color:var(--dsw-alias-label-secondary)}',
      '.gitc-text{white-space:pre;flex:1 1 auto}',
      '.gitc-line-add{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 11%,transparent)}',
      '.gitc-line-del{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 11%,transparent)}',
      '.gitc-line-add .gitc-sign,.gitc-line-add .gitc-num{color:var(--dsw-alias-state-success-primary)}',
      '.gitc-line-del .gitc-sign,.gitc-line-del .gitc-num{color:var(--dsw-alias-state-error-primary)}',
      '.gitc-line-hunk{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}',
      '.gitc-line-hunk .gitc-text{padding:1px 0}',
      '.gitc-line-meta{color:var(--dsw-alias-label-secondary)}',
      '.gitc-note{flex:none;padding:8px 12px;color:var(--dsw-alias-label-secondary);font-size:11px;border-top:.5px solid var(--dsw-alias-border-l1)}',
      '.gitc-center{flex:1 1 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:28px 20px;color:var(--dsw-alias-label-secondary);font-size:12px;text-align:center}',
      '.gitc-center-title{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600}',
      '.gitc-error{color:var(--dsw-alias-state-error-primary)}',
      '.gitc-action{border:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:6px;padding:3px 12px;font:inherit;font-size:12px;cursor:pointer}',
      '.gitc-action:hover{background:var(--dsw-alias-bg-layer-2)}',
      '.gitc-action:disabled{opacity:.55;cursor:default}',
      '.gitc-log{flex:1 1 auto;min-height:0;overflow:auto;padding:4px 0;font-size:11.5px;line-height:1.75}',
      '.gitc-log-row{display:flex;align-items:center;gap:6px;padding:0 12px;min-height:21px;white-space:nowrap}',
      '.gitc-log-row:hover{background:var(--dsw-alias-bg-layer-1)}',
      '.gitc-graph,.gitc-graph-only,.gitc-hash,.gitc-date{font-family:ui-monospace,SFMono-Regular,Consolas,"Cascadia Mono",monospace;font-variant-ligatures:none}',
      '.gitc-graph{flex:none;white-space:pre;color:var(--dsw-alias-state-idle-primary)}',
      '.gitc-graph-only{flex:none;white-space:pre;color:var(--dsw-alias-state-idle-primary)}',
      '.gitc-hash{flex:none;color:var(--dsw-alias-brand-primary)}',
      '.gitc-subject{flex:1 1 auto;min-width:60px;overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-label-primary);font-size:12px}',
      '.gitc-ref{flex:none;font-size:10px;line-height:1.6;padding:0 5px;border-radius:4px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}',
      '.gitc-ref-head{color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 15%,transparent)}',
      '.gitc-date{flex:none;color:var(--dsw-alias-label-secondary);font-size:10.5px}',
      '.gitc-title{display:inline-flex;align-items:center;gap:5px;min-width:0;overflow:hidden}',
      '.gitc-title-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    ].join('\n')

    const TITLE_CSS = '.gitc-title{display:inline-flex;align-items:center;gap:5px;min-width:0;overflow:hidden}'

    const zh = {
      title: 'Git 变更',
      description: '查看工作区改动、提交树，并可一键提交（本地/远程）与拉取',
      refresh: '刷新',
      refreshing: '刷新中…',
      loading: '正在读取仓库状态…',
      error: '读取失败：{message}',
      retry: '重试',
      noRepo: '当前目录不是 Git 仓库',
      noRepoHint: '请在一个 Git 仓库的工作区会话中打开此面板。',
      noChanges: '没有未提交的更改',
      noChangesHint: '工作区是干净的。',
      summary: '{files} 个文件 · +{additions} −{deletions}',
      summaryEmpty: '无改动',
      detached: '分离头指针',
      untracked: '未跟踪',
      staged: '已暂存',
      unstaged: '未暂存',
      binary: '二进制文件，无法显示文本差异。',
      emptyDiff: '没有可显示的文本差异。',
      diffLoading: '正在读取改动…',
      diffError: '无法读取改动：{message}',
      truncatedTag: '已截断',
      truncatedNote: '改动过大，仅显示前 {lines} 行。',
      tooLargeNote: '文件过大，仅显示开头部分内容。',
      selectHint: '在上方选择一个文件查看改动内容。',
      invalidPath: '文件路径不合法。',
      notFound: '文件已不存在。',
      noData: '没有数据。',
      tabChanges: '变更',
      tabTree: '提交树',
      pull: '拉取',
      pulling: '拉取中…',
      pullDone: '拉取完成：{detail}',
      pullDoneBare: '拉取完成',
      commit: '提交',
      committing: '提交中…',
      commitPlaceholder: '提交信息',
      defaultCommitMessage: 'chore: 更新 {files} 个文件',
      commitDone: '已提交 {hash}',
      commitChoice: '提交方式',
      commitLocal: '仅本地提交',
      commitRemote: '提交并推送',
      commitCancel: '取消',
      committedLocal: '已本地提交 {hash}',
      committedPushed: '已提交并推送 {hash}',
      pushFailedNotice: '已本地提交 {hash}，但推送失败：{message}',
      pushedOnly: '已推送本地提交',
      pushFailed: '推送失败：{message}',
      nothingToCommit: '没有需要提交的更改',
      emptyMessage: '请填写提交信息',
      noUpstream: '当前分支没有上游分支，无法拉取',
      actionFailed: '操作失败：{message}',
      logSummary: '{count} 个提交',
      logSummaryDiverged: '{count} 个提交 · ↑{ahead} ↓{behind}',
      noCommits: '还没有提交记录',
      logLoading: '正在读取提交历史…',
      logError: '读取提交历史失败：{message}',
      closeNotice: '关闭提示',
    }

    const en = {
      title: 'Git Changes',
      description: 'Working-tree changes, the commit graph, one-click commit (local or remote) and pull',
      refresh: 'Refresh',
      refreshing: 'Refreshing…',
      loading: 'Reading repository status…',
      error: 'Could not read changes: {message}',
      retry: 'Retry',
      noRepo: 'This directory is not a Git repository',
      noRepoHint: 'Open this panel from a session whose workspace is a Git repository.',
      noChanges: 'No uncommitted changes',
      noChangesHint: 'The working tree is clean.',
      summary: '{files} files · +{additions} −{deletions}',
      summaryEmpty: 'No changes',
      detached: 'detached HEAD',
      untracked: 'untracked',
      staged: 'staged',
      unstaged: 'unstaged',
      binary: 'Binary file — no textual diff to show.',
      emptyDiff: 'No textual diff to show.',
      diffLoading: 'Reading diff…',
      diffError: 'Could not read the diff: {message}',
      truncatedTag: 'truncated',
      truncatedNote: 'The diff is too large; showing the first {lines} lines.',
      tooLargeNote: 'The file is too large; showing only its beginning.',
      selectHint: 'Pick a file above to see its diff.',
      invalidPath: 'The file path is not valid.',
      notFound: 'The file no longer exists.',
      noData: 'No data.',
      tabChanges: 'Changes',
      tabTree: 'History',
      pull: 'Pull',
      pulling: 'Pulling…',
      pullDone: 'Pulled: {detail}',
      pullDoneBare: 'Pull finished',
      commit: 'Commit',
      committing: 'Committing…',
      commitPlaceholder: 'Commit message',
      defaultCommitMessage: 'chore: update {files} files',
      commitDone: 'Committed {hash}',
      commitChoice: 'Commit as',
      commitLocal: 'Local only',
      commitRemote: 'Commit & push',
      commitCancel: 'Cancel',
      committedLocal: 'Committed locally {hash}',
      committedPushed: 'Committed and pushed {hash}',
      pushFailedNotice: 'Committed locally {hash}, but the push failed: {message}',
      pushedOnly: 'Pushed local commits',
      pushFailed: 'Push failed: {message}',
      nothingToCommit: 'Nothing to commit',
      emptyMessage: 'Enter a commit message',
      noUpstream: 'The current branch has no upstream branch to pull from',
      actionFailed: 'Action failed: {message}',
      logSummary: '{count} commits',
      logSummaryDiverged: '{count} commits · ↑{ahead} ↓{behind}',
      noCommits: 'No commits yet',
      logLoading: 'Reading commit history…',
      logError: 'Could not read the commit history: {message}',
      closeNotice: 'Dismiss',
    }

    function GitBranchIcon(props) {
      const size = props && props.size ? props.size : 14
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 16 16',
          fill: 'none',
          'aria-hidden': 'true',
          style: { display: 'block', flex: 'none' },
        },
        h('path', { d: 'M5 3v10', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }),
        h('path', { d: 'M5 8.5c0 1.7 1.3 3 3 3h3', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }),
        h('circle', { cx: 5, cy: 3, r: 1.7, fill: 'currentColor' }),
        h('circle', { cx: 5, cy: 13, r: 1.7, fill: 'currentColor' }),
        h('circle', { cx: 11, cy: 11.5, r: 1.7, fill: 'currentColor' }),
      )
    }

    async function readResponse(response) {
      let body = null
      try {
        body = await response.json()
      } catch {
        body = null
      }
      if (response.ok === false) {
        const failure = new Error((body && body.message) || `HTTP ${response.status}`)
        failure.code = (body && body.code) || 'http'
        throw failure
      }
      if (body === null) throw new Error('invalid response')
      if (body.status === 'error') {
        const failure = new Error(body.message || body.code || 'request failed')
        failure.code = body.code || 'error'
        throw failure
      }
      return body
    }

    async function request(endpoint, params, signal) {
      const query = new URLSearchParams()
      for (const key of Object.keys(params)) query.set(key, String(params[key]))
      const response = await fetch(`${BASE}${endpoint}?${query.toString()}`, {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { [TOKEN_HEADER]: '1' },
        signal,
      })
      return readResponse(response)
    }

    async function postJson(endpoint, params, payload, signal) {
      const query = new URLSearchParams()
      for (const key of Object.keys(params)) query.set(key, String(params[key]))
      const response = await fetch(`${BASE}${endpoint}?${query.toString()}`, {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { [TOKEN_HEADER]: '1', 'content-type': 'application/json' },
        body: JSON.stringify(payload || {}),
        signal,
      })
      return readResponse(response)
    }

    function messageOf(error) {
      if (error === null || error === undefined) return 'unknown'
      if (typeof error === 'string') return error
      if (typeof error.message === 'string' && error.message !== '') return error.message
      return String(error)
    }

    function codeOf(error) {
      return error && typeof error.code === 'string' ? error.code : ''
    }

    /** Known business codes get copy of their own; anything else shows the Host text. */
    function errorText(t, kind, state) {
      if (state.code === 'notFound') return t('notFound')
      if (state.code === 'invalidPath') return t('invalidPath')
      return t(kind, { message: state.message })
    }

    function actionErrorText(t, error) {
      const code = codeOf(error)
      if (code === 'nothingToCommit') return t('nothingToCommit')
      if (code === 'emptyMessage') return t('emptyMessage')
      if (code === 'messageTooLong') return t('emptyMessage')
      if (code === 'noUpstream') return t('noUpstream')
      if (code === 'pushFailed') return t('pushFailed', { message: messageOf(error) })
      if (code === 'notRepository') return t('noRepo')
      return t('actionFailed', { message: messageOf(error) })
    }

    function badgeClass(file) {
      const letter = String(file.status || 'M')
      if (file.untracked) return 'gitc-badge gitc-badge-unt'
      if (letter === 'A') return 'gitc-badge gitc-badge-add'
      if (letter === 'D') return 'gitc-badge gitc-badge-del'
      if (letter === 'R' || letter === 'C') return 'gitc-badge gitc-badge-ren'
      if (letter === 'U') return 'gitc-badge gitc-badge-unm'
      return 'gitc-badge gitc-badge-mod'
    }

    function badgeLetter(file) {
      if (file.untracked) return '?'
      const letter = String(file.status || 'M')
      return letter === 'C' ? 'R' : letter
    }

    function fileTitle(t, file) {
      const parts = [file.path]
      if (file.oldPath) parts.push(`← ${file.oldPath}`)
      if (file.untracked) parts.push(t('untracked'))
      else if (file.staged && file.unstaged) parts.push(`${t('staged')} + ${t('unstaged')}`)
      else if (file.staged) parts.push(t('staged'))
      else if (file.unstaged) parts.push(t('unstaged'))
      return parts.join(' · ')
    }

    /** Split one unified diff into renderable rows with a single line-number column. */
    function parsePatch(patch) {
      const rows = []
      let oldLine = 0
      let newLine = 0
      const lines = String(patch).split('\n')
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index]
        if (line === '' && index === lines.length - 1) continue
        const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
        if (hunk !== null) {
          oldLine = Number(hunk[1])
          newLine = Number(hunk[2])
          rows.push({ kind: 'hunk', number: null, text: line })
          continue
        }
        if (
          line.startsWith('diff --git ') ||
          line.startsWith('index ') ||
          line.startsWith('--- ') ||
          line.startsWith('+++ ') ||
          line.startsWith('new file mode') ||
          line.startsWith('deleted file mode') ||
          line.startsWith('old mode') ||
          line.startsWith('new mode') ||
          line.startsWith('similarity index') ||
          line.startsWith('rename from ') ||
          line.startsWith('rename to ') ||
          line.startsWith('copy from ') ||
          line.startsWith('copy to ') ||
          line.startsWith('Binary files ') ||
          line.startsWith('\\')
        ) {
          rows.push({ kind: 'meta', number: null, text: line })
          continue
        }
        if (line.startsWith('+')) {
          rows.push({ kind: 'add', number: newLine, text: line.slice(1) })
          newLine += 1
          continue
        }
        if (line.startsWith('-')) {
          rows.push({ kind: 'del', number: oldLine, text: line.slice(1) })
          oldLine += 1
          continue
        }
        if (line.startsWith(' ')) {
          rows.push({ kind: 'context', number: newLine, text: line.slice(1) })
          oldLine += 1
          newLine += 1
          continue
        }
        rows.push({ kind: 'meta', number: null, text: line })
      }
      return rows
    }

    function renderRows(t, rows, truncated) {
      const visible = rows.length > MAX_RENDER_ROWS ? rows.slice(0, MAX_RENDER_ROWS) : rows
      const nodes = visible.map((row, index) => {
        if (row.kind === 'hunk') {
          return h('div', { key: index, className: 'gitc-line gitc-line-hunk' }, h('span', { className: 'gitc-text' }, row.text))
        }
        const gutter = row.number === null ? '' : String(row.number)
        const sign = row.kind === 'add' ? '+' : row.kind === 'del' ? '−' : ' '
        return h(
          'div',
          { key: index, className: `gitc-line gitc-line-${row.kind}` },
          h('span', { className: 'gitc-num' }, gutter),
          h('span', { className: 'gitc-sign' }, sign),
          h('span', { className: 'gitc-text' }, row.text),
        )
      })
      if (rows.length > MAX_RENDER_ROWS) {
        nodes.push(h('div', { key: 'cut', className: 'gitc-note' }, t('truncatedNote', { lines: MAX_RENDER_ROWS })))
      }
      if (truncated === true) nodes.push(h('div', { key: 'truncated', className: 'gitc-note' }, t('tooLargeNote')))
      return nodes
    }

    /** `%d` decorations: ` (HEAD -> main, origin/main, tag: v1)`. */
    function parseRefs(raw) {
      if (typeof raw !== 'string') return []
      let text = raw.trim()
      if (text.startsWith('(')) text = text.slice(1)
      if (text.endsWith(')')) text = text.slice(0, -1)
      text = text.trim()
      if (text === '') return []
      return text
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value !== '')
        .slice(0, 4)
    }

    function isHeadRef(ref) {
      return ref.startsWith('HEAD') || ref.startsWith('tag:')
    }

    function shortDate(value) {
      if (typeof value !== 'string') return ''
      return value.length > 5 ? value.slice(value.length - 5) : value
    }

    function GitChangesBody(props) {
      const t = typeof props.t === 'function' ? props.t : (key) => key
      const sessionId = typeof props.sessionId === 'string' ? props.sessionId : ''
      const [seq, setSeq] = React.useState(0)
      const [view, setView] = React.useState('changes')
      const [status, setStatus] = React.useState({ phase: 'loading' })
      const [selectedPath, setSelectedPath] = React.useState(null)
      const [diff, setDiff] = React.useState({ phase: 'idle' })
      const [log, setLog] = React.useState({ phase: 'idle' })
      const [message, setMessage] = React.useState('')
      const [messageTouched, setMessageTouched] = React.useState(false)
      const [busy, setBusy] = React.useState(null)
      const [commitChoice, setCommitChoice] = React.useState(false)
      const [notice, setNotice] = React.useState(null)

      const reload = () => setSeq((value) => value + 1)

      React.useEffect(() => {
        const onFocus = () => setSeq((value) => value + 1)
        window.addEventListener('focus', onFocus)
        return () => window.removeEventListener('focus', onFocus)
      }, [])

      React.useEffect(() => {
        if (notice === null) return undefined
        const timer = setTimeout(() => setNotice(null), NOTICE_TIMEOUT_MS)
        return () => clearTimeout(timer)
      }, [notice])

      React.useEffect(() => {
        const controller = new AbortController()
        setStatus((current) =>
          current.phase === 'ready' ? { phase: 'ready', data: current.data, refreshing: true } : { phase: 'loading' },
        )
        request('/status', { sessionId }, controller.signal).then(
          (data) => {
            if (controller.signal.aborted) return
            setStatus({ phase: 'ready', data, refreshing: false })
          },
          (error) => {
            if (controller.signal.aborted) return
            setStatus({ phase: 'error', message: messageOf(error), code: codeOf(error) })
          },
        )
        return () => controller.abort()
      }, [sessionId, seq])

      React.useEffect(() => {
        if (view !== 'tree') return undefined
        const controller = new AbortController()
        setLog((current) =>
          current.phase === 'ready' ? { phase: 'ready', data: current.data, refreshing: true } : { phase: 'loading' },
        )
        request('/log', { sessionId, limit: LOG_LIMIT }, controller.signal).then(
          (data) => {
            if (controller.signal.aborted) return
            setLog({ phase: 'ready', data })
          },
          (error) => {
            if (controller.signal.aborted) return
            setLog({ phase: 'error', message: messageOf(error), code: codeOf(error) })
          },
        )
        return () => controller.abort()
      }, [sessionId, seq, view])

      const ready = status.phase === 'ready'
      const data = ready ? status.data : null
      const files = data && Array.isArray(data.files) ? data.files : []

      React.useEffect(() => {
        if (status.phase !== 'ready') return
        const next = Array.isArray(status.data.files) ? status.data.files : []
        if (next.length === 0) {
          if (selectedPath !== null) setSelectedPath(null)
          return
        }
        if (selectedPath !== null && next.some((file) => file.path === selectedPath)) return
        setSelectedPath(next[0].path)
      }, [status, selectedPath])

      React.useEffect(() => {
        if (messageTouched || message !== '') return
        if (status.phase !== 'ready') return
        const count = status.data && status.data.summary ? Number(status.data.summary.files) : 0
        if (!(count > 0)) return
        setMessage(t('defaultCommitMessage', { files: count }))
      }, [status, message, messageTouched])

      const selectedFile =
        selectedPath === null ? null : files.find((file) => file.path === selectedPath) || null
      const selectedUntracked = selectedFile !== null && selectedFile.untracked === true

      React.useEffect(() => {
        if (selectedFile === null) {
          setDiff({ phase: 'idle' })
          return undefined
        }
        const controller = new AbortController()
        setDiff({ phase: 'loading' })
        request(
          '/diff',
          {
            sessionId,
            path: selectedFile.path,
            oldPath: selectedFile.oldPath || '',
            untracked: selectedFile.untracked === true ? '1' : '0',
          },
          controller.signal,
        ).then(
          (result) => {
            if (controller.signal.aborted) return
            setDiff({ phase: 'ready', data: result })
          },
          (error) => {
            if (controller.signal.aborted) return
            setDiff({ phase: 'error', message: messageOf(error), code: codeOf(error) })
          },
        )
        return () => controller.abort()
        // The selected file's identity is its path plus whether it is untracked.
      }, [sessionId, seq, selectedFile === null ? '' : selectedFile.path, selectedFile === null ? '' : selectedFile.oldPath || '', selectedUntracked])

      const logReady = log.phase === 'ready'
      const logData = logReady ? log.data : null
      const logEntries = logData && Array.isArray(logData.entries) ? logData.entries : []
      const logCommitCount = logEntries.filter((entry) => entry.hash !== null).length
      const notRepo =
        view === 'changes'
          ? data !== null && data.isRepo === false
          : logReady && logData.isRepo === false

      const switchView = (next) => {
        if (next === view) return
        setView(next)
        setSeq((value) => value + 1)
      }

      const pendingAhead = data !== null && Number(data.ahead) > 0
      const canCommit = notRepo === false && busy === null && (files.length > 0 || pendingAhead)

      const chooseCommit = () => {
        if (busy !== null || notRepo) return
        if (canCommit === false) {
          setNotice({ kind: 'error', text: t('nothingToCommit') })
          return
        }
        setCommitChoice((value) => !value)
      }

      const commit = (mode) => {
        if (busy !== null || notRepo) return
        const text = message.trim()
        const hasWork = files.length > 0
        if (hasWork && text === '') {
          setNotice({ kind: 'error', text: t('emptyMessage') })
          return
        }
        if (hasWork === false && mode === 'local') {
          setCommitChoice(false)
          setNotice({ kind: 'error', text: t('nothingToCommit') })
          return
        }
        setCommitChoice(false)
        setBusy('commit')
        setNotice(null)
        postJson('/commit', { sessionId }, { message: text, mode }).then(
          (result) => {
            setBusy(null)
            const committed = result.committed === true
            const pushed = result.pushed === true
            const pushFailed = result.pushed === false
            if (committed) {
              setMessage('')
              setMessageTouched(false)
            }
            const hash = typeof result.hash === 'string' ? result.hash : ''
            let nextNotice
            if (committed && pushed) {
              nextNotice = { kind: 'ok', text: t('committedPushed', { hash }) }
            } else if (committed && pushFailed) {
              nextNotice = {
                kind: 'error',
                text: t('pushFailedNotice', { hash, message: result.pushMessage || '' }),
              }
            } else if (committed) {
              nextNotice = { kind: 'ok', text: t('committedLocal', { hash }) }
            } else if (pushed) {
              nextNotice = { kind: 'ok', text: t('pushedOnly') }
            } else {
              nextNotice = { kind: 'ok', text: t('committedLocal', { hash }) }
            }
            setNotice(nextNotice)
            setSeq((value) => value + 1)
          },
          (error) => {
            setBusy(null)
            setNotice({ kind: 'error', text: actionErrorText(t, error) })
          },
        )
      }

      const pull = () => {
        if (busy !== null || notRepo) return
        setBusy('pull')
        setNotice(null)
        postJson('/pull', { sessionId }, {}).then(
          (result) => {
            setBusy(null)
            const detail = typeof result.detail === 'string' ? result.detail : ''
            setNotice({ kind: 'ok', text: detail === '' ? t('pullDoneBare') : t('pullDone', { detail }) })
            setSeq((value) => value + 1)
          },
          (error) => {
            setBusy(null)
            setNotice({ kind: 'error', text: actionErrorText(t, error) })
          },
        )
      }

      let summary = ''
      if (view === 'changes') {
        summary =
          data !== null && data.isRepo && data.summary
            ? Number(data.summary.files) === 0
              ? t('summaryEmpty')
              : t('summary', {
                  files: data.summary.files,
                  additions: data.summary.additions,
                  deletions: data.summary.deletions,
                })
            : ''
      } else if (logReady && logData.isRepo) {
        summary =
          logData.upstream && (Number(logData.ahead) > 0 || Number(logData.behind) > 0)
            ? t('logSummaryDiverged', { count: logCommitCount, ahead: Number(logData.ahead) || 0, behind: Number(logData.behind) || 0 })
            : t('logSummary', { count: logCommitCount })
      }

      const branchLabel =
        data === null
          ? t('title')
          : data.isRepo
            ? data.branch || t('detached')
            : t('noRepo')

      const header = h(
        'div',
        { className: 'gitc-top' },
        h('span', { className: 'gitc-branch' }, h(GitBranchIcon, { size: 14 }), h('span', { className: 'gitc-branch-text' }, branchLabel)),
        summary === '' ? null : h('span', { className: 'gitc-summary' }, summary),
        h(
          'button',
          {
            type: 'button',
            className: 'gitc-refresh',
            title: t('refresh'),
            'aria-label': t('refresh'),
            disabled: status.phase === 'loading' || status.refreshing === true,
            onClick: reload,
          },
          status.refreshing === true ? t('refreshing') : t('refresh'),
        ),
      )

      const toolbar = h(
        'div',
        { className: 'gitc-toolbar' },
        h(
          'div',
          { className: 'gitc-switch', role: 'tablist' },
          h(
            'button',
            { type: 'button', role: 'tab', 'aria-selected': view === 'changes', onClick: () => switchView('changes') },
            t('tabChanges'),
          ),
          h(
            'button',
            { type: 'button', role: 'tab', 'aria-selected': view === 'tree', onClick: () => switchView('tree') },
            t('tabTree'),
          ),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'gitc-pull',
            title: t('pull'),
            disabled: busy !== null || notRepo,
            onClick: pull,
          },
          busy === 'pull' ? t('pulling') : t('pull'),
        ),
      )

      const commitBar =
        view === 'changes'
          ? h(
              'div',
              { className: 'gitc-commit' },
              h('input', {
                className: 'gitc-input',
                type: 'text',
                value: message,
                placeholder: t('commitPlaceholder'),
                'aria-label': t('commitPlaceholder'),
                disabled: busy !== null,
                onChange: (event) => {
                  setMessageTouched(true)
                  setMessage(event.target.value)
                },
                onKeyDown: (event) => {
                  if (event.nativeEvent.isComposing || event.keyCode === 229) return
                  if (event.key === 'Enter') chooseCommit()
                },
              }),
              h(
                'button',
                {
                  type: 'button',
                  className: 'gitc-action',
                  disabled: busy !== null || notRepo || (files.length === 0 && pendingAhead === false),
                  'aria-expanded': commitChoice,
                  title: t('commit'),
                  onClick: chooseCommit,
                },
                busy === 'commit' ? t('committing') : t('commit'),
              ),
            )
          : null

      const choiceRow =
        view === 'changes' && commitChoice
          ? h(
              'div',
              { className: 'gitc-choice' },
              h('span', { className: 'gitc-choice-label' }, t('commitChoice')),
              h(
                'button',
                {
                  type: 'button',
                  className: 'gitc-choice-btn',
                  disabled: busy !== null,
                  onClick: () => commit('local'),
                },
                t('commitLocal'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'gitc-choice-btn gitc-choice-primary',
                  disabled: busy !== null,
                  onClick: () => commit('remote'),
                },
                t('commitRemote'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'gitc-choice-btn',
                  disabled: busy !== null,
                  onClick: () => setCommitChoice(false),
                },
                t('commitCancel'),
              ),
            )
          : null

      const noticeRow =
        notice === null
          ? null
          : h(
              'div',
              { className: `gitc-notice gitc-notice-${notice.kind}`, role: 'status' },
              notice.text,
            )

      let body = null
      if (view === 'changes') {
        if (status.phase === 'loading') {
          body = h('div', { className: 'gitc-center' }, h('span', null, t('loading')))
        } else if (status.phase === 'error') {
          body = h(
            'div',
            { className: 'gitc-center' },
            h('span', { className: 'gitc-error' }, errorText(t, 'error', status)),
            h('button', { type: 'button', className: 'gitc-action', onClick: reload }, t('retry')),
          )
        } else if (data !== null && data.isRepo === false) {
          body = h(
            'div',
            { className: 'gitc-center' },
            h('span', { className: 'gitc-center-title' }, t('noRepo')),
            h('span', null, t('noRepoHint')),
          )
        } else if (files.length === 0) {
          body = h(
            'div',
            { className: 'gitc-center' },
            h('span', { className: 'gitc-center-title' }, t('noChanges')),
            h('span', null, t('noChangesHint')),
          )
        } else {
          const list = h(
            'div',
            { className: 'gitc-list' },
            files.map((file) =>
              h(
                'button',
                {
                  key: file.path,
                  type: 'button',
                  className: 'gitc-row',
                  'aria-pressed': file.path === selectedPath,
                  title: fileTitle(t, file),
                  onClick: () => setSelectedPath(file.path),
                },
                h('span', { className: badgeClass(file) }, badgeLetter(file)),
                h('span', { className: 'gitc-path' }, file.path),
                typeof file.additions === 'number' || typeof file.deletions === 'number'
                  ? h(
                      'span',
                      { className: 'gitc-counts' },
                      h('span', { className: 'gitc-add' }, `+${typeof file.additions === 'number' ? file.additions : 0}`),
                      h('span', { className: 'gitc-del' }, `−${typeof file.deletions === 'number' ? file.deletions : 0}`),
                    )
                  : null,
              ),
            ),
          )

          let diffBody = null
          if (selectedFile === null) {
            diffBody = h('div', { className: 'gitc-note' }, t('selectHint'))
          } else if (diff.phase === 'idle' || diff.phase === 'loading') {
            diffBody = h('div', { className: 'gitc-center' }, h('span', null, t('diffLoading')))
          } else if (diff.phase === 'error') {
            diffBody = h(
              'div',
              { className: 'gitc-center' },
              h('span', { className: 'gitc-error' }, errorText(t, 'diffError', diff)),
              h('button', { type: 'button', className: 'gitc-action', onClick: reload }, t('retry')),
            )
          } else if (diff.data.binary === true) {
            diffBody = h('div', { className: 'gitc-center' }, h('span', null, t('binary')))
          } else if (typeof diff.data.patch !== 'string' || diff.data.patch === '') {
            diffBody = h('div', { className: 'gitc-center' }, h('span', null, t('emptyDiff')))
          } else {
            const rows = parsePatch(diff.data.patch)
            diffBody = h('div', { className: 'gitc-lines' }, renderRows(t, rows, diff.data.truncated === true))
          }

          body = h(
            'div',
            { style: { display: 'contents' } },
            list,
            h(
              'div',
              { className: 'gitc-diff' },
              h(
                'div',
                { className: 'gitc-diff-head' },
                h(
                  'span',
                  { className: 'gitc-diff-path', title: selectedFile === null ? '' : selectedFile.path },
                  selectedFile === null ? t('title') : selectedFile.path,
                ),
                selectedFile !== null && selectedFile.untracked
                  ? h('span', { className: 'gitc-tag' }, t('untracked'))
                  : null,
                diff.phase === 'ready' && diff.data.truncated === true
                  ? h('span', { className: 'gitc-tag' }, t('truncatedTag'))
                  : null,
              ),
              diffBody,
            ),
          )
        }
      } else if (log.phase === 'loading') {
        body = h('div', { className: 'gitc-center' }, h('span', null, t('logLoading')))
      } else if (log.phase === 'error') {
        body = h(
          'div',
          { className: 'gitc-center' },
          h('span', { className: 'gitc-error' }, errorText(t, 'logError', log)),
          h('button', { type: 'button', className: 'gitc-action', onClick: reload }, t('retry')),
        )
      } else if (logData !== null && logData.isRepo === false) {
        body = h(
          'div',
          { className: 'gitc-center' },
          h('span', { className: 'gitc-center-title' }, t('noRepo')),
          h('span', null, t('noRepoHint')),
        )
      } else if (logEntries.length === 0) {
        body = h('div', { className: 'gitc-center' }, h('span', null, t('noCommits')))
      } else {
        body = h(
          'div',
          { className: 'gitc-log' },
          logEntries.map((entry, index) => {
            if (entry.hash === null) {
              return h(
                'div',
                { key: index, className: 'gitc-log-row' },
                h('span', { className: 'gitc-graph-only' }, entry.graph),
              )
            }
            const refs = parseRefs(entry.refs)
            return h(
              'div',
              { key: index, className: 'gitc-log-row', title: `${entry.author || ''} ${entry.date || ''}`.trim() },
              h('span', { className: 'gitc-graph' }, entry.graph),
              h('span', { className: 'gitc-hash' }, entry.hash),
              refs.map((ref, refIndex) =>
                h(
                  'span',
                  { key: `ref-${refIndex}`, className: isHeadRef(ref) ? 'gitc-ref gitc-ref-head' : 'gitc-ref' },
                  ref,
                ),
              ),
              h('span', { className: 'gitc-subject' }, entry.subject),
              h('span', { className: 'gitc-date' }, shortDate(entry.date)),
            )
          }),
        )
      }

      return h(
        'div',
        { className: 'gitc-root' },
        h('style', { key: 'gitc-css' }, CSS),
        header,
        toolbar,
        commitBar,
        choiceRow,
        noticeRow,
        body,
      )
    }

    function GitChangesTitle(props) {
      const t = typeof props.t === 'function' ? props.t : (key) => key
      return h(
        'span',
        { className: 'gitc-title' },
        h('style', { key: 'gitc-title-css' }, TITLE_CSS),
        h(GitBranchIcon, { size: 14 }),
        h('span', { className: 'gitc-title-text' }, t('title')),
      )
    }

    const inject = ['slots', 'locale', 'sidebarRightTabs']

    function apply(ctx) {
      const t = ctx.locale.bind(NS)
      ctx.effect(
        () =>
          ctx.locale.register(NS, {
            zh,
            en,
          }),
        'git-changes: copy',
      )
      ctx.effect(
        () =>
          ctx.sidebarRightTabs.register({
            id: ID,
            kind: KIND,
            priority: 'builtin',
            title: () => t('title'),
            guide: [
              {
                id: KIND,
                order: 30,
                title: () => t('title'),
                description: () => t('description'),
                icon: GitBranchIcon,
              },
            ],
          }),
        'git-changes: tab type',
      )
      ctx.effect(
        () =>
          ctx.slots.inject('sidebar.right.pane.tab', () =>
            ctx.slots.register(
              {
                name: 'sidebar.right.pane.tab',
                key: ID,
                locale: NS,
                inject: (sessionId) => ({ sessionId }),
              },
              GitChangesBody,
            ),
          ),
        'git-changes: tab body',
      )
      ctx.effect(
        () =>
          ctx.slots.inject('sidebar.right.pane.tab.title', () =>
            ctx.slots.register(
              {
                name: 'sidebar.right.pane.tab.title',
                key: ID,
                locale: NS,
              },
              GitChangesTitle,
            ),
          ),
        'git-changes: tab title',
      )
    }

    return { inject, apply }
  },
})
