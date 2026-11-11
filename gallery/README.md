# 온라인 3D 전시관

강의 수강생 작품을 전시하는 가상 3D 전시관입니다.

- `site/` — 배포되는 정적 사이트 (빌드 과정 없음)
  - `index.html` 첫 화면(프로필·전시회 현황판), 3D 1층 로비, 3D 전시실
  - `admin.html` 관리자 화면 (전시회 생성, 기간·포스터 설정, 진행/종료 전환)
  - `js/config.js` Supabase 주소와 공개 키
- `supabase/migrations/` — 데이터베이스 스키마와 RPC 함수
- `supabase/functions/gallery/` — 작품 업로드/삭제용 Edge Function

## 구조

- 호스팅: Netlify (https://adissam-gallery.netlify.app, 배포 폴더 `gallery/site`)
- 백엔드: Supabase (Postgres + Storage + Realtime + Edge Function)
- 모든 테이블은 RLS로 잠겨 있고, 코드/관리자 토큰을 확인하는 RPC 함수로만 접근합니다.
- 관리자 비밀번호는 `admin.html` 첫 접속 시 설정합니다.

## 로컬 실행

```bash
cd gallery/site && python3 -m http.server 8765
```
