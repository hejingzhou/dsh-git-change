/**
 * Host half of the DSH Git Changes bundle.
 *
 * Serves read-only observations and two explicit user actions over the same
 * same-origin JSON surface the Client half's right-sidebar tab consumes:
 *
 *   GET  /dsh-git-changes/status?sessionId=<id>
 *   GET  /dsh-git-changes/diff?sessionId=<id>&path=<repo-relative-path>&oldPath=<old>&untracked=0|1
 *   GET  /dsh-git-changes/log?sessionId=<id>&limit=<n>
 *   POST /dsh-git-changes/commit  { sessionId, message }
 *   POST /dsh-git-changes/pull    { sessionId }
 *
 * Observation commands (`rev-parse`, `status`, `diff`, `ls-files`, `log`) never
 * mutate the repository, and `GIT_OPTIONAL_LOCKS=0` keeps them from writing
 * index locks. The two actions are the user's explicit buttons: commit stages
 * the whole working tree (`git add -A`) then commits, and pull only
 * fast-forwards (`git pull --ff-only`) so it never fabricates a merge commit.
 * The Session named on the request decides the directory (its recorded `cwd`,
 * else the deployment default), so the Client can never ask for an arbitrary
 * path.
 */
import { execFile } from 'node:child_process'
import { open, stat } from 'node:fs/promises'
import { resolve as resolvePath, sep } from 'node:path'

/** Hard dependency: the routes are served by the browser HTTP carrier. */
export const inject = ['webServer']

/** Route namespace owned by this bundle. Keep `client.js` in sync. */
const BASE = '/dsh-git-changes'
/** A cross-site form cannot set this header, so it doubles as a same-page gate. */
const TOKEN_HEADER = 'x-dsh-git-changes'
const GIT_TIMEOUT_MS = 15_000
const GIT_ACTION_TIMEOUT_MS = 60_000
const GIT_NETWORK_TIMEOUT_MS = 120_000
const GIT_MAX_BUFFER = 16 * 1024 * 1024
const MAX_PATCH_BYTES = 1_500_000
const MAX_TEXT_BYTES = 512 * 1024
const MAX_UNTRACKED_COUNTS = 80
const MAX_BODY_BYTES = 64 * 1024
const MAX_COMMIT_MESSAGE = 4000
const MAX_LOG_ENTRIES = 300
/** Pages this machine may have opened: loopback, private network, or `.local`. */
const LOCAL_ADDRESS =
  /^(127\.\d+\.\d+\.\d+|localhost|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|[a-z0-9-]+\.local)(:\d+)?$/u
/** Internal sentinels for a body the route refuses before it reaches a handler. */
const BODY_INVALID = Symbol('invalid-body')
const BODY_TOO_LARGE = Symbol('body-too-large')

/** Register the seven routes; all of them dispose with the plugin. */
export function apply(ctx) {
  registerRoute(ctx, `${BASE}/status`, ['GET'], async (url, _body, signal) => {
    return collectStatus(ctx, url.searchParams.get('sessionId') || '', signal)
  })
  registerRoute(ctx, `${BASE}/diff`, ['GET'], async (url, _body, signal) => {
    return collectDiff(
      ctx,
      url.searchParams.get('sessionId') || '',
      url.searchParams.get('path') || '',
      url.searchParams.get('oldPath') || '',
      signal,
    )
  })
  registerRoute(ctx, `${BASE}/log`, ['GET'], async (url, _body, signal) => {
    return collectLog(ctx, url.searchParams.get('sessionId') || '', url.searchParams.get('limit') || '', signal)
  })
  registerRoute(ctx, `${BASE}/branches`, ['GET'], async (url, _body, signal) => {
    return collectBranches(ctx, url.searchParams.get('sessionId') || '', signal)
  })
  registerRoute(ctx, `${BASE}/switch`, ['POST'], async (url, body, signal) => {
    return switchBranch(ctx, url.searchParams.get('sessionId') || '', body, signal)
  })
  registerRoute(ctx, `${BASE}/commit`, ['POST'], async (url, body, signal) => {
    return commitAll(ctx, url.searchParams.get('sessionId') || '', body, signal)
  })
  registerRoute(ctx, `${BASE}/pull`, ['POST'], async (url, _body, signal) => {
    return pullFastForward(ctx, url.searchParams.get('sessionId') || '', signal)
  })
}

function registerRoute(ctx, path, methods, handler) {
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path,
        handler: async (req, res) => {
          if (requestAllowed(req) === false) {
            sendJson(res, 403, { status: 'error', code: 'forbidden', message: 'forbidden' })
            return
          }
          const method = String((req && req.method) || 'GET').toUpperCase()
          if (methods.includes(method) === false) {
            sendJson(res, 405, { status: 'error', code: 'method', message: `${methods.join('/')} only` })
            return
          }
          let body
          if (method === 'POST') {
            body = await readJsonBody(req)
            if (body === BODY_TOO_LARGE) {
              sendJson(res, 413, { status: 'error', code: 'bodyTooLarge', message: 'request body is too large' })
              return
            }
            if (body === BODY_INVALID) {
              sendJson(res, 400, { status: 'error', code: 'invalidBody', message: 'request body must be a JSON object' })
              return
            }
          }
          const controller = new AbortController()
          const onClose = () => controller.abort()
          res.on('close', onClose)
          try {
            const url = new URL(String((req && req.url) || path), 'http://localhost')
            const payload = await handler(url, body, controller.signal)
            res.off('close', onClose)
            sendJson(res, 200, payload)
          } catch (error) {
            res.off('close', onClose)
            sendJson(res, 500, {
              status: 'error',
              code: 'internal',
              message: oneLine((error && error.message) || String(error)),
            })
          }
        },
      }),
    `git-changes: ${path}`,
  )
}

/**
 * Gate one request. A same-origin page can set the token header; a browser
 * sends it only after a preflight this server never allows, and the address
 * check covers the rebinding case that bypasses preflight.
 */
function requestAllowed(req) {
  try {
    const headers = (req && req.headers) || {}
    const token = headers[TOKEN_HEADER]
    if (typeof token !== 'string' || token === '') return false
    const host = typeof headers.host === 'string' ? headers.host.trim().toLowerCase() : ''
    // A request without an address is not a browser request; the token is the gate.
    if (host !== '' && LOCAL_ADDRESS.test(host) === false) return false
    const origin = typeof headers.origin === 'string' ? headers.origin.trim().toLowerCase() : ''
    if (origin === 'null') return false
    if (origin !== '') {
      let originHost = ''
      try {
        originHost = new URL(origin).host.toLowerCase()
      } catch {
        return false
      }
      if (host !== '' && originHost !== host) return false
    }
    return true
  } catch {
    return false
  }
}

function readJsonBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolve) => {
    let size = 0
    let done = false
    const parts = []
    const finish = (value) => {
      if (done === true) return
      done = true
      clearTimeout(timer)
      resolve(value)
    }
    const timer = setTimeout(() => {
      finish(BODY_INVALID)
      try {
        req.destroy?.()
      } catch {
        /* the request is already gone */
      }
    }, 10_000)
    timer.unref?.()
    try {
      req.on('data', (chunk) => {
        size += chunk.length
        if (size > limit) {
          finish(BODY_TOO_LARGE)
          try {
            req.destroy?.()
          } catch {
            /* the request is already gone */
          }
          return
        }
        parts.push(Buffer.from(chunk))
      })
      req.on('end', () => {
        const text = Buffer.concat(parts).toString('utf8').trim()
        if (text === '') {
          finish({})
          return
        }
        try {
          const parsed = JSON.parse(text)
          finish(parsed !== null && typeof parsed === 'object' && Array.isArray(parsed) === false ? parsed : BODY_INVALID)
        } catch {
          finish(BODY_INVALID)
        }
      })
      req.on('error', () => finish(BODY_INVALID))
    } catch {
      finish(BODY_INVALID)
    }
  })
}

function sendJson(res, status, payload) {
  try {
    if (res.writableEnded === true || res.destroyed === true) return
    let body = ''
    try {
      body = JSON.stringify(payload)
    } catch {
      body = '{"status":"error","code":"unserializable","message":"unserializable"}'
    }
    if (res.headersSent === true) {
      res.end()
      return
    }
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'content-length': Buffer.byteLength(body),
    })
    res.end(body)
  } catch {
    try {
      if (res.writableEnded !== true && res.destroyed !== true) res.end()
    } catch {
      /* the socket is already gone */
    }
  }
}

/** The Session's directory, else the deployment default. Never a client path. */
function resolveDirectory(ctx, sessionId) {
  if (typeof sessionId === 'string' && sessionId !== '') {
    try {
      const sessions = ctx.get('sessions')
      const session =
        sessions && typeof sessions.get === 'function' ? sessions.get(sessionId) : undefined
      const cwd = session && session.header && typeof session.header.cwd === 'string' ? session.header.cwd : ''
      if (cwd !== '') return cwd
    } catch {
      /* fall through to the deployment default */
    }
  }
  try {
    const workingDirectory = ctx.get('workingDirectory')
    if (
      workingDirectory &&
      typeof workingDirectory.defaultDirectory === 'string' &&
      workingDirectory.defaultDirectory !== ''
    ) {
      return workingDirectory.defaultDirectory
    }
  } catch {
    /* ignore */
  }
  return process.cwd()
}

/** Locate the repository that owns the Session's directory. */
async function locateRepository(ctx, sessionId, signal) {
  const directory = resolveDirectory(ctx, sessionId)
  const top = await runGit(['rev-parse', '--show-toplevel'], directory, signal)
  const rootRaw = top.stdout.trim()
  if (top.error && rootRaw === '') {
    return {
      directory,
      error: {
        status: 'error',
        code: 'notRepository',
        message: oneLine(top.stderr || (top.error && top.error.message) || 'not a git repository'),
      },
    }
  }
  return { directory, root: rootRaw === '' ? directory : resolvePath(rootRaw) }
}

/** Run one git command; never rejects, so callers read stdout/stderr. */
function runGit(args, cwd, signal, timeoutMs = GIT_TIMEOUT_MS) {
  return new Promise((resolve) => {
    try {
      execFile(
        'git',
        args,
        {
          cwd,
          windowsHide: true,
          timeout: timeoutMs,
          maxBuffer: GIT_MAX_BUFFER,
          encoding: 'utf8',
          env: gitEnvironment(),
          signal,
        },
        (error, stdout, stderr) => {
          resolve({
            error,
            stdout: typeof stdout === 'string' ? stdout : '',
            stderr: typeof stderr === 'string' ? stderr : '',
          })
        },
      )
    } catch (error) {
      resolve({ error, stdout: '', stderr: '' })
    }
  })
}

function gitEnvironment() {
  const env = { ...process.env }
  env.GIT_OPTIONAL_LOCKS = '0'
  env.GIT_TERMINAL_PROMPT = '0'
  env.GIT_PAGER = 'cat'
  env.PAGER = 'cat'
  env.LC_ALL = 'C'
  env.LANG = 'C'
  delete env.GIT_EXTERNAL_DIFF
  return env
}

async function collectStatus(ctx, sessionId, signal) {
  const located = await locateRepository(ctx, sessionId, signal)
  if (located.error !== undefined) {
    return {
      status: 'ok',
      isRepo: false,
      cwd: located.directory,
      message: located.error.message,
    }
  }
  const { directory, root } = located
  const statusResult = await runGit(
    ['-c', 'core.quotepath=false', 'status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all'],
    root,
    signal,
  )
  const parsed = parseStatus(statusResult.stdout)
  if (statusResult.error && statusResult.stdout === '') {
    return {
      status: 'ok',
      isRepo: true,
      root,
      cwd: directory,
      branch: parsed.branch,
      detached: parsed.detached,
      upstream: parsed.upstream,
      ahead: parsed.ahead,
      behind: parsed.behind,
      files: [],
      summary: summarize([]),
      generatedAt: Date.now(),
      message: oneLine(statusResult.stderr || (statusResult.error && statusResult.error.message) || ''),
    }
  }
  const numstat = await readNumstat(root, signal)
  for (const file of parsed.files) {
    const counts = numstat.get(file.path)
    if (counts !== undefined) {
      file.additions = counts.additions
      file.deletions = counts.deletions
      if (counts.binary) file.binary = true
    }
  }
  await fillUntrackedCounts(root, parsed.files, signal)
  return {
    status: 'ok',
    isRepo: true,
    root,
    cwd: directory,
    branch: parsed.branch,
    detached: parsed.detached,
    upstream: parsed.upstream,
    ahead: parsed.ahead,
    behind: parsed.behind,
    files: parsed.files,
    summary: summarize(parsed.files),
    generatedAt: Date.now(),
  }
}

/** `git status --porcelain=v2 --branch -z` → header facts and one row per file. */
function parseStatus(output) {
  const files = []
  const result = { files, branch: null, detached: false, upstream: null, ahead: 0, behind: 0 }
  if (typeof output !== 'string' || output === '') return result
  const tokens = output.split('\0')
  /** The token after a `2 ` row is its renamed/copied original path. */
  let pendingRename = false
  for (const token of tokens) {
    if (token === '') continue
    if (pendingRename) {
      const file = files[files.length - 1]
      if (file !== undefined) file.oldPath = token
      pendingRename = false
      continue
    }
    if (token.startsWith('# ')) {
      const [key, ...rest] = token.slice(2).split(' ')
      const value = rest.join(' ')
      if (key === 'branch.head') {
        result.branch = value === '(detached)' ? null : value
        result.detached = value === '(detached)'
      } else if (key === 'branch.upstream') {
        result.upstream = value
      } else if (key === 'branch.ab') {
        const match = /^\+(\d+) -(\d+)$/.exec(value)
        if (match !== null) {
          result.ahead = Number(match[1])
          result.behind = Number(match[2])
        }
      }
      continue
    }
    if (token.startsWith('? ')) {
      files.push({
        path: token.slice(2),
        oldPath: null,
        kind: 'untracked',
        status: '?',
        index: '?',
        worktree: '?',
        staged: false,
        unstaged: true,
        untracked: true,
        unmerged: false,
        additions: null,
        deletions: null,
        binary: false,
      })
      continue
    }
    if (token.startsWith('1 ')) {
      const fields = token.split(' ')
      files.push(fileRow(fields.slice(8).join(' '), fields[1], null, 'changed'))
      continue
    }
    if (token.startsWith('2 ')) {
      const fields = token.split(' ')
      files.push(fileRow(fields.slice(9).join(' '), fields[1], null, 'renamed'))
      pendingRename = true
      continue
    }
    if (token.startsWith('u ')) {
      const fields = token.split(' ')
      const row = fileRow(fields.slice(10).join(' '), fields[1], null, 'unmerged')
      row.unmerged = true
      row.status = 'U'
      files.push(row)
      continue
    }
    // `! ` ignored entries are not requested; anything else is not a row.
  }
  return result
}

function fileRow(path, xy, oldPath, kind) {
  const index = xy.length > 0 ? xy[0] : '.'
  const worktree = xy.length > 1 ? xy[1] : '.'
  const unmerged = kind === 'unmerged'
  let status = 'M'
  if (kind === 'renamed') status = 'R'
  else if (kind === 'unmerged') status = 'U'
  else if (worktree !== '.' && worktree !== ' ') status = worktree
  else if (index !== '.' && index !== ' ') status = index
  return {
    path,
    oldPath,
    kind,
    status,
    index,
    worktree,
    staged: index !== '.' && index !== ' ',
    unstaged: worktree !== '.' && worktree !== ' ',
    untracked: false,
    unmerged,
    additions: null,
    deletions: null,
    binary: false,
  }
}

/** `git diff --numstat -z` → path → line counts (or binary). */
function parseNumstat(output) {
  const map = new Map()
  if (typeof output !== 'string' || output === '') return map
  const tokens = output.split('\0')
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    const first = token.indexOf('\t')
    if (first < 0) continue
    const second = token.indexOf('\t', first + 1)
    if (second < 0) continue
    const additionsRaw = token.slice(0, first)
    const deletionsRaw = token.slice(first + 1, second)
    let path = token.slice(second + 1)
    if (path === '') {
      // Rename/copy rows carry the original then the new path as extra tokens.
      const next = tokens[index + 2]
      index += 2
      path = typeof next === 'string' ? next : ''
    }
    if (path === '') continue
    map.set(path, {
      additions: additionsRaw === '-' ? null : Number(additionsRaw),
      deletions: deletionsRaw === '-' ? null : Number(deletionsRaw),
      binary: additionsRaw === '-' || deletionsRaw === '-',
    })
  }
  return map
}

async function readNumstat(root, signal) {
  const head = await runGit(['-c', 'core.quotepath=false', 'diff', '--numstat', '-z', 'HEAD'], root, signal)
  if (head.error === null || head.stdout !== '') return parseNumstat(head.stdout)
  // An unborn HEAD has nothing to diff against; the index is all there is.
  const cached = await runGit(
    ['-c', 'core.quotepath=false', 'diff', '--numstat', '-z', '--cached'],
    root,
    signal,
  )
  return parseNumstat(cached.stdout)
}

/** Cheap line counts for new files, which no diff command reports. */
async function fillUntrackedCounts(root, files, signal) {
  let budget = MAX_UNTRACKED_COUNTS
  for (const file of files) {
    if (file.untracked !== true || budget <= 0) continue
    budget -= 1
    const safe = safeRepoPath(root, file.path)
    if (safe === null) continue
    const read = await readTextLimited(safe.absolute, MAX_TEXT_BYTES, signal)
    if (read === null || read.error !== undefined) continue
    if (read.binary) {
      file.binary = true
      continue
    }
    const text = read.buffer.toString('utf8')
    if (text === '') {
      file.additions = 0
      file.deletions = 0
      continue
    }
    const lines = text.split('\n')
    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
    file.additions = lines.length
    file.deletions = 0
  }
}

async function collectDiff(ctx, sessionId, requestedPath, requestedOldPath, signal) {
  const located = await locateRepository(ctx, sessionId, signal)
  if (located.error !== undefined) return located.error
  const { root } = located
  const safe = safeRepoPath(root, requestedPath)
  if (safe === null) {
    return { status: 'error', code: 'invalidPath', message: 'invalid repository path' }
  }
  const otherSafe = requestedOldPath === '' ? null : safeRepoPath(root, requestedOldPath)
  if (requestedOldPath !== '' && otherSafe === null) {
    return { status: 'error', code: 'invalidPath', message: 'invalid repository path' }
  }
  const others = await runGit(
    ['-c', 'core.quotepath=false', 'ls-files', '--others', '--exclude-standard', '-z', '--', safe.relative],
    root,
    signal,
  )
  const isUntracked = others.stdout !== ''
  if (isUntracked) {
    const read = await readTextLimited(safe.absolute, MAX_TEXT_BYTES, signal)
    if (read === null) return { status: 'error', code: 'notFound', message: 'file is not readable' }
    if (read.error !== undefined) return { status: 'error', code: read.error, message: read.message }
    if (read.binary) {
      return {
        status: 'ok',
        path: safe.relative,
        untracked: true,
        binary: true,
        patch: null,
        truncated: false,
        size: read.size,
      }
    }
    return {
      status: 'ok',
      path: safe.relative,
      untracked: true,
      binary: false,
      patch: limitedPatch(untrackedPatch(safe.relative, read.buffer)),
      truncated: read.truncated,
      size: read.size,
    }
  }
  const tracked = await runGit(
    ['-c', 'core.quotepath=false', 'ls-files', '-z', '--', safe.relative],
    root,
    signal,
  )
  if (tracked.stdout === '' && otherSafe === null) {
    return { status: 'error', code: 'notFound', message: 'file is not tracked and not untracked' }
  }
  const baseArgs = ['-c', 'core.quotepath=false', 'diff', '--no-color', '--no-ext-diff', '--no-textconv', '-M', '-U3']
  // A rename is diffed with both sides so Git can print the rename rather than
  // a whole new file; a pure rename has no hunks, and the single-path form then
  // falls back to showing the file's content.
  const pathArgs = otherSafe === null ? [safe.relative] : [otherSafe.relative, safe.relative]
  let result = await runGit([...baseArgs, 'HEAD', '--', ...pathArgs], root, signal)
  if (result.error !== null && result.stdout === '') {
    // An unborn HEAD has no commit side; compare the index with the worktree.
    result = await runGit([...baseArgs, '--cached', '--', ...pathArgs], root, signal)
  }
  if (otherSafe !== null && result.stdout.trim() === '') {
    result = await runGit([...baseArgs, 'HEAD', '--', safe.relative], root, signal)
    if (result.error !== null && result.stdout === '') {
      result = await runGit([...baseArgs, '--cached', '--', safe.relative], root, signal)
    }
  }
  if (result.error !== null && result.stdout === '') {
    return {
      status: 'error',
      code: 'gitFailed',
      message: oneLine(result.stderr || (result.error && result.error.message) || 'git diff failed'),
    }
  }
  const patch = result.stdout
  const binary = /^Binary files .* differ$/mu.test(patch) || /^GIT binary patch$/mu.test(patch)
  return {
    status: 'ok',
    path: safe.relative,
    untracked: false,
    binary,
    patch: binary ? null : limitedPatch(patch),
    truncated: patch.length > MAX_PATCH_BYTES,
    size: null,
  }
}

/**
 * The commit graph, rendered by Git itself so the ASCII topology stays correct
 * for merges. Each entry carries the graph prefix, hash and metadata separately
 * so the Client can color them; continuation rows carry only the graph prefix.
 */
async function collectLog(ctx, sessionId, requestedLimit, signal) {
  const located = await locateRepository(ctx, sessionId, signal)
  if (located.error !== undefined) {
    return { status: 'ok', isRepo: false, cwd: located.directory, entries: [], message: located.error.message }
  }
  const { root } = located
  const parsedLimit = Number.parseInt(String(requestedLimit), 10)
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), MAX_LOG_ENTRIES) : 150
  const head = await runGit(['rev-parse', '--verify', '--quiet', 'HEAD'], root, signal)
  const branchInfo = await readBranchInfo(root, signal)
  if (head.error !== null) {
    return {
      status: 'ok',
      isRepo: true,
      root,
      empty: true,
      branch: branchInfo.branch,
      upstream: branchInfo.upstream,
      ahead: branchInfo.ahead,
      behind: branchInfo.behind,
      entries: [],
    }
  }
  const result = await runGit(
    [
      '-c',
      'core.quotepath=false',
      'log',
      '--graph',
      '--color=never',
      '--date=short',
      '--pretty=format:%h%x09%ad%x09%an%x09%d%x09%s',
      '-n',
      String(limit),
    ],
    root,
    signal,
  )
  if (result.error !== null && result.stdout === '') {
    return {
      status: 'error',
      code: 'gitFailed',
      message: oneLine(result.stderr || (result.error && result.error.message) || 'git log failed'),
    }
  }
  return {
    status: 'ok',
    isRepo: true,
    root,
    branch: branchInfo.branch,
    upstream: branchInfo.upstream,
    ahead: branchInfo.ahead,
    behind: branchInfo.behind,
    entries: parseLog(result.stdout),
  }
}

/** `git log --graph` output → renderable rows. */
function parseLog(output) {
  const entries = []
  if (typeof output !== 'string' || output === '') return entries
  for (const line of output.split('\n')) {
    if (line === '') continue
    const firstTab = line.indexOf('\t')
    if (firstTab < 0) {
      entries.push({ graph: line, hash: null, date: '', author: '', refs: '', subject: '' })
      continue
    }
    const prefix = line.slice(0, firstTab)
    const fields = line.slice(firstTab + 1).split('\t')
    const hashMatch = /([0-9a-f]{7,40})$/u.exec(prefix)
    if (hashMatch === null) {
      entries.push({ graph: line, hash: null, date: '', author: '', refs: '', subject: '' })
      continue
    }
    entries.push({
      graph: prefix.slice(0, hashMatch.index),
      hash: hashMatch[1],
      date: fields[0] || '',
      author: fields[1] || '',
      refs: fields[2] || '',
      subject: fields.slice(3).join('\t') || '',
    })
  }
  return entries
}

async function readBranchInfo(root, signal) {
  const info = { branch: null, detached: false, upstream: null, ahead: 0, behind: 0 }
  const symbolic = await runGit(['symbolic-ref', '--short', '-q', 'HEAD'], root, signal)
  if (symbolic.error === null && symbolic.stdout.trim() !== '') {
    info.branch = symbolic.stdout.trim()
  } else {
    const head = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], root, signal)
    if (head.error === null && head.stdout.trim() !== '') {
      const value = head.stdout.trim()
      info.branch = value === 'HEAD' ? null : value
      info.detached = value === 'HEAD'
    }
  }
  const upstream = await runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], root, signal)
  if (upstream.error === null && upstream.stdout.trim() !== '') info.upstream = upstream.stdout.trim()
  const counts = await runGit(
    ['rev-list', '--left-right', '--count', '@{u}...HEAD'],
    root,
    signal,
  )
  if (counts.error === null) {
    const [behind, ahead] = counts.stdout.trim().split(/\s+/u)
    if (Number.isFinite(Number(ahead))) info.ahead = Number(ahead)
    if (Number.isFinite(Number(behind))) info.behind = Number(behind)
  }
  return info
}

/** Local branches, the current one, and whether the tree permits switching. */
async function collectBranches(ctx, sessionId, signal) {
  const located = await locateRepository(ctx, sessionId, signal)
  if (located.error !== undefined) {
    return {
      status: 'ok',
      isRepo: false,
      cwd: located.directory,
      branches: [],
      message: located.error.message,
    }
  }
  const { root } = located
  const status = await runGit(
    ['-c', 'core.quotepath=false', 'status', '--porcelain', '-z', '--untracked-files=all'],
    root,
    signal,
  )
  const result = await runGit(
    ['-c', 'core.quotepath=false', 'for-each-ref', '--format=%(refname:short)%09%(HEAD)%09%(upstream:short)', 'refs/heads'],
    root,
    signal,
  )
  const branches = []
  if (result.error === null || result.stdout !== '') {
    for (const line of result.stdout.split('\n')) {
      if (line === '') continue
      const fields = line.split('\t')
      const name = fields[0]
      if (typeof name !== 'string' || name === '') continue
      branches.push({
        name,
        current: fields[1] === '*',
        upstream: fields[2] || null,
      })
    }
  }
  branches.sort((a, b) => {
    if (a.current !== b.current) return a.current ? -1 : 1
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
  })
  const branchInfo = await readBranchInfo(root, signal)
  return {
    status: 'ok',
    isRepo: true,
    root,
    branch: branchInfo.branch,
    detached: branchInfo.detached,
    /** True only when nothing is staged, unstaged or untracked. */
    clean: status.stdout === '',
    branches,
  }
}

/**
 * Switch to one existing local branch. This is refused unless the working tree
 * is completely clean, because a switch moves HEAD under the user's files.
 */
async function switchBranch(ctx, sessionId, body, signal) {
  const located = await locateRepository(ctx, sessionId, signal)
  if (located.error !== undefined) return located.error
  const { root } = located
  const requested = body !== null && typeof body.branch === 'string' ? body.branch.trim() : ''
  if (requested === '' || requested.length > 255 || requested.startsWith('-')) {
    return { status: 'error', code: 'invalidBranch', message: 'invalid branch name' }
  }
  const valid = await runGit(['check-ref-format', '--branch', requested], root, signal)
  if (valid.error !== null) {
    return { status: 'error', code: 'invalidBranch', message: 'invalid branch name' }
  }
  const exists = await runGit(['rev-parse', '--verify', '--quiet', `refs/heads/${requested}`], root, signal)
  if (exists.error !== null) {
    return { status: 'error', code: 'branchNotFound', message: 'branch does not exist' }
  }
  const status = await runGit(
    ['-c', 'core.quotepath=false', 'status', '--porcelain', '-z', '--untracked-files=all'],
    root,
    signal,
  )
  if (status.stdout !== '') {
    return { status: 'error', code: 'dirtyWorkTree', message: 'the working tree has changes' }
  }
  const current = await runGit(['symbolic-ref', '--short', '-q', 'HEAD'], root, signal)
  if (current.error === null && current.stdout.trim() === requested) {
    return { status: 'ok', switched: false, branch: requested }
  }
  const switched = await runGit(['switch', requested], root, signal, GIT_ACTION_TIMEOUT_MS)
  if (switched.error !== null) {
    return {
      status: 'error',
      code: 'switchFailed',
      message: cleanGitMessage(switched.stderr || (switched.error && switched.error.message) || 'git switch failed'),
    }
  }
  return {
    status: 'ok',
    switched: true,
    branch: requested,
    detail: oneLine(switched.stderr || switched.stdout),
  }
}

/**
 * Commit the working tree, optionally pushing the branch afterwards.
 *
 * `mode: 'local'` only commits. `mode: 'remote'` commits when there is
 * something to commit and then pushes the current branch; with a clean tree it
 * pushes pending local commits instead, so the choice still works when only the
 * remote is behind. A successful commit whose push fails stays a success with
 * `pushed: false` and the push error in `pushMessage`, because the local commit
 * already exists and the Client must be able to say so.
 */
async function commitAll(ctx, sessionId, body, signal) {
  const located = await locateRepository(ctx, sessionId, signal)
  if (located.error !== undefined) return located.error
  const { root } = located
  const mode = body !== null && body.mode === 'remote' ? 'remote' : 'local'
  const statusResult = await runGit(
    ['-c', 'core.quotepath=false', 'status', '--porcelain', '-z', '--untracked-files=all'],
    root,
    signal,
  )
  if (statusResult.error !== null && statusResult.stdout === '') {
    return {
      status: 'error',
      code: 'commitFailed',
      message: oneLine(statusResult.stderr || (statusResult.error && statusResult.error.message) || 'git status failed'),
    }
  }
  const hasChanges = statusResult.stdout !== ''
  if (hasChanges === false) {
    if (mode === 'local') {
      return { status: 'error', code: 'nothingToCommit', message: 'nothing to commit' }
    }
    // Nothing to commit, but the choice was "commit and push": push what is
    // already committed locally instead of refusing.
    const pushed = await pushCurrent(root, signal)
    if (pushed.ok === false) {
      return { status: 'error', code: 'pushFailed', message: pushed.message }
    }
    return {
      status: 'ok',
      mode,
      committed: false,
      pushed: true,
      hash: '',
      summary: '',
      pushMessage: pushed.message,
      detail: pushed.message,
    }
  }
  const message = body !== null && typeof body.message === 'string' ? body.message.trim() : ''
  if (message === '') {
    return { status: 'error', code: 'emptyMessage', message: 'commit message is required' }
  }
  if (message.length > MAX_COMMIT_MESSAGE) {
    return { status: 'error', code: 'messageTooLong', message: 'commit message is too long' }
  }
  const add = await runGit(['add', '-A'], root, signal)
  if (add.error !== null) {
    return {
      status: 'error',
      code: 'commitFailed',
      message: oneLine(add.stderr || (add.error && add.error.message) || 'git add failed'),
    }
  }
  const staged = await runGit(['diff', '--cached', '--quiet'], root, signal)
  if (staged.error === null) {
    return { status: 'error', code: 'nothingToCommit', message: 'nothing to commit' }
  }
  const commit = await runGit(['commit', '-m', message], root, signal, GIT_ACTION_TIMEOUT_MS)
  if (commit.error !== null) {
    const detail = oneLine(commit.stderr || (commit.error && commit.error.message) || 'git commit failed')
    if (/nothing to commit|no changes added/iu.test(detail)) {
      return { status: 'error', code: 'nothingToCommit', message: detail }
    }
    return { status: 'error', code: 'commitFailed', message: detail }
  }
  const head = await runGit(['log', '-1', '--pretty=format:%h%x09%s'], root, signal)
  const [hash, ...summaryParts] = head.stdout.trim().split('\t')
  let pushed = null
  let pushMessage = null
  if (mode === 'remote') {
    const outcome = await pushCurrent(root, signal)
    pushed = outcome.ok
    pushMessage = outcome.message
  }
  return {
    status: 'ok',
    mode,
    committed: true,
    pushed,
    pushMessage,
    hash: typeof hash === 'string' ? hash : '',
    summary: summaryParts.join('\t'),
    detail: oneLine(commit.stdout),
  }
}

/**
 * Push the current branch. A branch without an upstream is pushed with `-u`
 * against `origin`, which is how the one-click path works on a fresh branch.
 */
async function pushCurrent(root, signal) {
  const upstream = await runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], root, signal)
  const hasUpstream = upstream.error === null && upstream.stdout.trim() !== ''
  if (hasUpstream === false) {
    const symbolic = await runGit(['symbolic-ref', '--short', '-q', 'HEAD'], root, signal)
    const branch = symbolic.error === null ? symbolic.stdout.trim() : ''
    if (branch === '') {
      return { ok: false, message: 'detached HEAD has no branch to push' }
    }
    const created = await runGit(['push', '-u', 'origin', branch], root, signal, GIT_NETWORK_TIMEOUT_MS)
    if (created.error === null) return { ok: true, message: oneLine(created.stdout || created.stderr) }
    return {
      ok: false,
      message: cleanGitMessage(created.stderr || (created.error && created.error.message) || 'git push failed'),
    }
  }
  const pushed = await runGit(['push'], root, signal, GIT_NETWORK_TIMEOUT_MS)
  if (pushed.error === null) return { ok: true, message: oneLine(pushed.stdout || pushed.stderr) }
  return {
    ok: false,
    message: cleanGitMessage(pushed.stderr || (pushed.error && pushed.error.message) || 'git push failed'),
  }
}

/** Fast-forward the current branch from its upstream; never creates a merge. */
async function pullFastForward(ctx, sessionId, signal) {
  const located = await locateRepository(ctx, sessionId, signal)
  if (located.error !== undefined) return located.error
  const { root } = located
  const upstream = await runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], root, signal)
  if (upstream.error !== null || upstream.stdout.trim() === '') {
    return {
      status: 'error',
      code: 'noUpstream',
      message: oneLine(upstream.stderr || 'the current branch has no upstream branch'),
    }
  }
  const pull = await runGit(['pull', '--ff-only'], root, signal, GIT_NETWORK_TIMEOUT_MS)
  if (pull.error !== null) {
    return {
      status: 'error',
      code: 'pullFailed',
      message: cleanGitMessage(pull.stderr || (pull.error && pull.error.message) || 'git pull failed'),
    }
  }
  return {
    status: 'ok',
    upstream: upstream.stdout.trim(),
    detail: oneLine(pull.stdout || pull.stderr),
  }
}

/** Resolve one repository-relative path against the root, or null when unsafe. */
function safeRepoPath(root, value) {
  if (typeof value !== 'string' || value === '' || value.length > 4096) return null
  if (value.includes('\0') || value.includes('\\')) return null
  if (value.startsWith('/') || /^[A-Za-z]:/.test(value)) return null
  const segments = value.split('/')
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) return null
  const absolute = resolvePath(root, ...segments)
  const prefix = root.endsWith(sep) ? root : root + sep
  if (absolute !== root && absolute.startsWith(prefix) === false) return null
  return { relative: segments.join('/'), absolute }
}

async function readTextLimited(absolute, limit, signal) {
  try {
    const info = await stat(absolute)
    if (info.isFile() === false) {
      return { error: 'notAFile', message: 'not a regular file', size: info.size }
    }
    if (typeof signal !== 'undefined' && signal.aborted) {
      return { error: 'aborted', message: 'request aborted', size: info.size }
    }
    const length = Math.min(info.size, limit)
    const handle = await open(absolute, 'r')
    try {
      const buffer = Buffer.alloc(length)
      const { bytesRead } = await handle.read(buffer, 0, length, 0)
      const bytes = buffer.subarray(0, bytesRead)
      const head = bytes.subarray(0, Math.min(bytes.length, 8192))
      return {
        buffer: bytes,
        binary: head.includes(0),
        truncated: info.size > limit,
        size: info.size,
      }
    } finally {
      await handle.close()
    }
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return { error: 'notFound', message: 'file is not readable', size: 0 }
    }
    return { error: 'unreadable', message: oneLine((error && error.message) || String(error)), size: 0 }
  }
}

function untrackedPatch(relative, buffer) {
  const text = buffer.toString('utf8')
  const lines = text === '' ? [] : text.split('\n')
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  const added = lines.map((line) => `+${line}`).join('\n')
  const body = added === '' ? '' : `${added}\n`
  return `diff --git a/${relative} b/${relative}\nnew file mode 100644\n--- /dev/null\n+++ b/${relative}\n@@ -0,0 +1,${lines.length} @@\n${body}`
}

function limitedPatch(patch) {
  if (typeof patch !== 'string') return ''
  if (patch.length <= MAX_PATCH_BYTES) return patch
  return patch.slice(0, MAX_PATCH_BYTES)
}

function summarize(files) {
  const summary = { files: files.length, additions: 0, deletions: 0, untracked: 0, binary: 0 }
  for (const file of files) {
    if (file.untracked) summary.untracked += 1
    if (file.binary) summary.binary += 1
    if (typeof file.additions === 'number') summary.additions += file.additions
    if (typeof file.deletions === 'number') summary.deletions += file.deletions
  }
  return summary
}

function oneLine(value) {
  return String(value === undefined || value === null ? '' : value)
    // Remote servers may color their output; a panel notice must stay plain text.
    .replace(/\u001b\[[0-9;]*m/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, 300)
}

/** Git's advice lines are noise in a one-line panel notice. */
function cleanGitMessage(value) {
  return oneLine(
    String(value === undefined || value === null ? '' : value)
      .split('\n')
      .filter((line) => line.trim().startsWith('hint:') === false)
      .join('\n'),
  )
}
