# 8체질 밥상

음식을 먹은 뒤의 느낌을 체크해 8체질 중 어디에 가까운지 알려주고, 맞는 음식·식단을 추천하는 웹앱입니다. 빌드 과정 없는 정적 사이트라 `index.html`을 그대로 열거나 아무 정적 호스팅에 올리면 됩니다.

## 기능
- **체질 테스트**: 27문항(음식 반응 19 + 몸의 반응 8). 가입 없이 가능.
- **결과**: 8체질별 가까운 정도(%), 특징, 맞는 음식·안 맞는 음식, 생활 가이드.
- **가입/저장**: 카카오·네이버 로그인 시 결과 저장(비회원으로 한 결과는 가입 시 계정으로 이전).
- **일주일 추천 식단**(회원): 하루 2끼 / 3끼 / 3끼+간식1 / 3끼+간식2 선택. 매 끼 주식·단백질·채소(+국) 구성, 열량·3대 영양소 표시.
- **음식 확인**: 음식·재료 입력 → 좋아요 / 보통 / 안 좋아요 + 설명. 김치찌개 같은 메뉴는 재료별로 판단.
- **내 정보**: 테스트 다시 하기(결과 업데이트), 체질 직접 선택, 기록, 데이터 삭제.

## 실행·테스트
```bash
npx serve .            # 또는 index.html을 브라우저로 열기
node tests/engine.test.js
node tests/e2e.js /tmp/shots   # Playwright 필요
```

## 실제 로그인 켜기 (지금은 체험 모드)
`config.js`가 비어 있으면 **체험 모드**로, 로그인 버튼이 이 기기 브라우저에만 저장되는 체험 계정을 만듭니다. 실제 연동 절차:

1. Supabase 프로젝트 생성 → SQL Editor에서 `supabase/schema.sql` 실행.
2. **카카오**: Kakao Developers에서 앱 생성 → 카카오 로그인 활성화, Redirect URI에 `https://<프로젝트>.supabase.co/auth/v1/callback` 등록 → Supabase Auth > Providers > Kakao에 REST API 키와 Client Secret 입력.
3. **네이버**: 네이버 개발자센터에서 애플리케이션 등록(네이버 로그인, Callback URL은 위와 동일) → Supabase Auth의 Custom OAuth provider로 등록(식별자 `naver` → 클라이언트에서는 `custom:naver`).
   - 인증 `https://nid.naver.com/oauth2.0/authorize`, 토큰 `https://nid.naver.com/oauth2.0/token`, 사용자 정보 `https://openapi.naver.com/v1/nid/me`
   - ⚠️ 네이버는 사용자 정보를 `response` 안에 감싸서 돌려주는 비표준 형식이라, Custom provider가 그대로 받아들이는지는 **아직 실제로 검증하지 못했습니다.** 안 되면 Edge Function으로 네이버 토큰을 교환해 세션을 만드는 방식이 필요합니다.
4. Supabase Auth > URL Configuration에 배포 주소를 Site URL/Redirect URL로 등록.
5. `config.js`에 `SUPABASE_URL`, `SUPABASE_ANON_KEY` 입력 후 배포.

## 구조
- `js/data.js` 체질·식품 분류·설문·요리 데이터 / `js/engine.js` 판정·음식 확인·식단 로직 / `js/store.js` 로그인·저장 / `js/app.js` 화면
- `docs/8체질_조사자료.md` 조사 자료와 출처

## 주의
8체질은 한의학 체질 이론이며 이 앱은 참고용 자가 점검입니다. 의학적 진단이 아닙니다.
