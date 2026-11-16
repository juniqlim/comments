# comments

어느 사이트에나 붙이는 댓글. 의존성 없음.

    <div id="comments"></div>
    <script type="module" src="https://juniqlim.github.io/comments/src/comments.js"></script>

- 저장 — Supabase `comments` 스키마 (thinkthink 와 같은 프로젝트, 스키마로 분리)
- 로그인 — Supabase Auth 의 Google. 익명은 봇이 설쳐서 받지 않는다
- 권한 — RLS (`db/schema.sql`). 읽기는 누구나, 쓰기는 본인, 지우기는 본인과 주인
- 페이지 — origin + 경로. `.html` 과 `index` 는 떼고 본다

## 백업

작성자 이메일이 들어가므로 비공개 저장소 `juniqlim/comments-backup` 에 둔다.

## 사이트 추가

Supabase → Authentication → URL Configuration 의 Redirect URLs 에 `https://<사이트>/**` 를 넣는다.

## 테스트

    npm test
