/**
 * 어느 사이트에나 붙이는 댓글.
 *
 *   <div id="comments"></div>
 *   <script type="module" src=".../comments.js"></script>
 *
 * 저장은 Supabase(comments 스키마), 로그인은 Supabase Auth 의 Google.
 * 의존성 없이 REST 로만 말한다.
 */

const SUPABASE_URL = 'https://zuvifgiiahbypxsvnzvg.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1dmlmZ2lpYWhieXB4c3ZuenZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NTMwNDQsImV4cCI6MjEwMDQyOTA0NH0.sVexgnQmy0YRcg3bjq0ThHB8sgPLtn1X3SDDyUbeG18'
/** RLS 의 지우기 정책과 같은 값 — 두 곳이 어긋나면 안 된다 */
const OWNER_EMAIL = 'juniq.lim@gmail.com'
const SESSION_KEY = 'comments:session'

/** 쿼리·해시·.html 이 달라도 같은 글이다. index 는 디렉터리와 같은 글이다 */
export function pageKey({ origin, pathname }) {
  return origin + pathname.replace(/\.html$/, '').replace(/(^|\/)index$/, '$1')
}

/** Google 로그인에서 돌아오면 해시에 토큰이 실려 온다 */
export function sessionFromHash(hash, nowSec) {
  const p = new URLSearchParams(hash.replace(/^#/, ''))
  const access_token = p.get('access_token')
  if (!access_token) return null
  return {
    access_token,
    refresh_token: p.get('refresh_token'),
    expires_at: nowSec + Number(p.get('expires_in')),
  }
}

/** 요청 도중 만료되지 않게 1분 앞당겨 본다 */
export function isExpired(session, nowSec) {
  return nowSec >= session.expires_at - 60
}

/** 화면에 무엇을 보일지 정하려고 읽는다. 권한은 서버(RLS)가 정한다 */
export function claimsOf(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

export function canDelete(comment, claims, ownerEmail) {
  if (!claims) return false
  return comment.user_id === claims.sub || claims.email === ownerEmail
}

// ── 브라우저 ──────────────────────────────────────────────

const now = () => Math.floor(Date.now() / 1000)

function headers(session) {
  return {
    apikey: SUPABASE_ANON,
    authorization: `Bearer ${session ? session.access_token : SUPABASE_ANON}`,
    'accept-profile': 'comments',
    'content-profile': 'comments',
    'content-type': 'application/json',
  }
}

async function call(path, init = {}, session = null) {
  const res = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers: headers(session) })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${text}`)
  return text ? JSON.parse(text) : null
}

const saveSession = s => (s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY))

async function currentSession() {
  const fromHash = sessionFromHash(location.hash, now())
  if (fromHash) {
    history.replaceState(null, '', location.pathname + location.search)
    saveSession(fromHash)
    return fromHash
  }
  const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
  if (!saved || !isExpired(saved, now())) return saved
  try {
    const r = await call('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: saved.refresh_token }),
    })
    const fresh = { access_token: r.access_token, refresh_token: r.refresh_token, expires_at: now() + r.expires_in }
    saveSession(fresh)
    return fresh
  } catch {
    saveSession(null)
    return null
  }
}

function signIn() {
  const back = location.origin + location.pathname + location.search
  location.href = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(back)}`
}

const el = (tag, props = {}, ...children) => {
  const e = Object.assign(document.createElement(tag), props)
  e.append(...children.filter(Boolean))
  return e
}

const STYLE = `
.cm { margin-top: 3rem; border-top: 1px solid color-mix(in srgb, currentColor 20%, transparent); padding-top: 1rem; }
.cm-item { display: flex; gap: .6rem; margin: 1rem 0; }
.cm-avatar { width: 28px; height: 28px; border-radius: 50%; flex: none; }
.cm-meta { font-size: .85em; opacity: .7; }
.cm-body { white-space: pre-wrap; margin: .2rem 0 0; }
.cm textarea { width: 100%; box-sizing: border-box; min-height: 5rem; font: inherit; color: inherit; background: transparent;
  border: 1px solid color-mix(in srgb, currentColor 30%, transparent); border-radius: 4px; padding: .5rem; }
.cm button { font: inherit; cursor: pointer; }
.cm-link { background: none; border: 0; padding: 0; color: inherit; text-decoration: underline; opacity: .7; font-size: .85em !important; }
`

async function mount(root) {
  document.head.append(el('style', { textContent: STYLE }))
  root.classList.add('cm')
  const page = pageKey(location)
  let session = await currentSession()

  async function render() {
    const claims = session && claimsOf(session.access_token)
    const list = await call(`/rest/v1/comments?select=*&page=eq.${encodeURIComponent(page)}&order=created_at`)

    const items = list.map(c =>
      el('div', { className: 'cm-item' },
        /^https:\/\//.test(c.avatar || '') && el('img', { className: 'cm-avatar', src: c.avatar, alt: '', referrerPolicy: 'no-referrer' }),
        el('div', {},
          el('div', { className: 'cm-meta' },
            `${c.name} · ${new Date(c.created_at).toLocaleString()} `,
            canDelete(c, claims, OWNER_EMAIL) && el('button', {
              className: 'cm-link', textContent: '지우기',
              onclick: async () => {
                if (!confirm('지울까요?')) return
                await call(`/rest/v1/comments?id=eq.${c.id}`, { method: 'DELETE' }, session)
                render()
              },
            })),
          el('p', { className: 'cm-body', textContent: c.body }))))

    const form = claims
      ? (() => {
          const box = el('textarea', { placeholder: '댓글을 남겨주세요', maxLength: 2000 })
          return el('div', {},
            box,
            el('div', { className: 'cm-meta' },
              el('button', {
                textContent: '남기기',
                onclick: async () => {
                  if (!box.value.trim()) return
                  await call('/rest/v1/comments', { method: 'POST', body: JSON.stringify({ page, body: box.value }) }, session)
                  render()
                },
              }),
              ` ${claims.user_metadata?.full_name || claims.email} `,
              el('button', { className: 'cm-link', textContent: '로그아웃', onclick: () => { saveSession(null); session = null; render() } })))
        })()
      : el('button', { textContent: 'Google로 로그인하고 댓글 남기기', onclick: signIn })

    root.replaceChildren(el('h2', { textContent: `댓글 ${list.length}` }), ...items, form)
  }

  render()
}

if (typeof document !== 'undefined') {
  const root = document.getElementById('comments')
  if (root) mount(root)
}
