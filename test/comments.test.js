import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pageKey, sessionFromHash, isExpired, claimsOf, canDelete } from '../src/comments.js'

test('페이지는 주소에서 쿼리와 해시를 뺀 것이다', () => {
  assert.equal(pageKey({ origin: 'https://wiki.juniq.im', pathname: '/TDD' }), 'https://wiki.juniq.im/TDD')
})

test('.html 은 붙든 안 붙든 같은 페이지다 — GitHub Pages 는 둘 다 내준다', () => {
  assert.equal(pageKey({ origin: 'https://a.com', pathname: '/TDD.html' }), 'https://a.com/TDD')
})

test('index.html 과 / 는 같은 페이지다', () => {
  assert.equal(pageKey({ origin: 'https://a.com', pathname: '/x/index.html' }), 'https://a.com/x/')
  assert.equal(pageKey({ origin: 'https://a.com', pathname: '/x/index' }), 'https://a.com/x/')
})

test('로그인에서 돌아온 해시로 세션을 만든다', () => {
  const s = sessionFromHash('#access_token=AT&refresh_token=RT&expires_in=3600&token_type=bearer', 1000)
  assert.deepEqual(s, { access_token: 'AT', refresh_token: 'RT', expires_at: 1000 + 3600 })
})

test('토큰이 없는 해시는 세션이 아니다', () => {
  assert.equal(sessionFromHash('#section-2', 0), null)
  assert.equal(sessionFromHash('', 0), null)
})

test('만료 1분 전부터 만료로 본다', () => {
  assert.equal(isExpired({ expires_at: 1000 }, 900), false)
  assert.equal(isExpired({ expires_at: 1000 }, 950), true)
})

test('토큰에서 신원을 읽는다', () => {
  const payload = Buffer.from(JSON.stringify({ sub: 'u1', email: 'a@b.c' })).toString('base64url')
  assert.deepEqual(claimsOf(`h.${payload}.s`), { sub: 'u1', email: 'a@b.c' })
  assert.equal(claimsOf('broken'), null)
})

test('지우기는 본인이나 주인만', () => {
  const owner = 'owner@x.com'
  assert.equal(canDelete({ user_id: 'u1' }, { sub: 'u1', email: 'a@b.c' }, owner), true)
  assert.equal(canDelete({ user_id: 'u1' }, { sub: 'u2', email: owner }, owner), true)
  assert.equal(canDelete({ user_id: 'u1' }, { sub: 'u2', email: 'a@b.c' }, owner), false)
  assert.equal(canDelete({ user_id: 'u1' }, null, owner), false)
})
