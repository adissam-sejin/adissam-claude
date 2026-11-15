# 감사노트 · 감 농장 🍊

매일 감사한 일을 **원고지**에 적고, **정사각형 사진** 한 장을 남기는 모바일 우선 웹앱입니다.
함께하는 그룹(감나무)에 감사가 쌓이면 도트 감나무가 자라고, 101번째 감사부터 주황색 감이 열려요.

- **Next.js 15 (App Router)** + **Tailwind CSS 4**
- **Supabase**: 카카오 로그인(Auth), Postgres + RLS(권한), Storage(사진)
- 배포: **Netlify** (https://gamsa-note.netlify.app) — `netlify.toml` 포함

## 화면 구성

| 경로 | 내용 |
|---|---|
| `/` | 소개 + **카카오로 시작하기** |
| `/write` | 원고지 입력, 사진 정사각형 자르기, 공개 체크(사진 있을 때만) |
| `/calendar` | 달력에 감 아이콘, “올해 총 365일 중 N일 작성” 카운트 |
| `/gallery` | 내 사진 3열 그리드(최신순), 누르면 감사 내용 |
| `/feed` | 공개된 감사 피드, 좋아요(감)·댓글 |
| `/farm` | 3D 감 농장. 감나무에 그룹 이름 팻말, 기간·D-day |
| `/settings` | 닉네임 변경, 감나무 코드 입력, 월 단위 PDF 저장, 로그아웃 |
| `/admin` | 관리자: 감나무 생성/수정/삭제(이름·코드·기간), 참여자 목록과 **개수만** 보기 |

감나무 성장: 0 씨앗 → 1~19 새싹 → 20~44 떡잎 → 45~69 어린 나무 → 70~99 자라는 나무 → 100 풍성한 나무 → **101+ 감이 열림**
(감나무 개수 = 키우는 기간 안에 참여자들이 쓴 감사노트 수)

## 설치 & 배포 순서

### 1. Supabase 프로젝트
1. https://supabase.com 에서 새 프로젝트 생성
2. **SQL Editor**에 `supabase/schema.sql` 전체를 붙여넣고 Run
3. **Project Settings → API**에서 `Project URL`, `anon(publishable) key` 복사

### 2. 카카오 로그인
1. https://developers.kakao.com → 내 애플리케이션 → 앱 추가
2. **카카오 로그인** 활성화 ON
3. **Redirect URI**에 `https://<프로젝트ID>.supabase.co/auth/v1/callback` 등록
4. **동의항목**: 닉네임·프로필 사진(필수/선택), 카카오계정(이메일)은 가능하면 선택 동의
5. **앱 키 → REST API 키**, **보안 → Client Secret** 발급(활성화)
6. Supabase **Authentication → Providers → Kakao** 켜고 REST API 키 / Client Secret 입력
   - 이메일 동의를 받을 수 없는 앱이라면 **“Allow users without an email”** 을 켜세요.
7. Supabase **Authentication → URL Configuration**
   - Site URL: `https://내도메인`
   - Redirect URLs: `https://내도메인/auth/callback` (로컬 테스트용 `http://localhost:3000/auth/callback`도)

### 3. 환경변수
`.env.example`을 `.env.local`로 복사해서 채웁니다.

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_SITE_URL=https://내도메인
```

### 4. 실행 / 배포
```bash
npm install
npm run dev        # http://localhost:3000
```
Netlify: 사이트 환경변수에 위 3개를 넣고 `gamsa-note` 폴더를 배포합니다 (`netlify.toml` 포함).

### 5. 관리자 지정
카카오로 한 번 로그인한 뒤, Supabase SQL Editor에서:
```sql
update public.profiles set is_admin = true where nickname = '내닉네임';
```
이후 `https://내도메인/admin` 으로 들어가면 됩니다.

## 개인정보 / 권한 설계
- 감사노트는 **기본 비공개**. 공개는 사진이 있을 때만 가능(DB 제약으로도 강제).
- 사진 버킷은 비공개이며, 본인 사진 + 공개된 노트의 사진만 서명 URL로 열람됩니다.
- 관리자/감농장은 **개수만** 집계하는 DB 함수로 조회하며, 내용은 볼 수 없습니다.
- 감나무 코드는 관리자만 볼 수 있고, 일반 사용자는 코드로 참여만 가능합니다.

## 아이콘 · 오픈그래프
`public/` 에 파비콘(`favicon.ico`, `icons/favicon-*.png`, `icons/icon.svg`), 홈 화면 아이콘
(`apple-touch-icon.png`, `icon-192/512.png`, `maskable-512.png`), `og-image.png`(1200×630)가 들어 있습니다.
3D 감·감나무 에셋과 아이콘은 Three.js로 렌더링합니다: `npm run assets` (Playwright 필요, `scripts/render3d/`).

폰트: 제목 Jua, 원고지 글씨 Gowun Batang, 본문 Pretendard.
