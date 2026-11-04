# 힉스필드 프롬프트 템플릿 (gpt_image_2_5, 검증 완료)

2026년 11월 #61·#62 10장을 이 템플릿으로 만들었고 한글 오타 0건이었다.
`{…}`만 바꿔 쓴다. 따옴표 안 한글은 그대로 이미지에 그려지므로 맞춤법을 꼭 다시 읽는다.

공통 파라미터:
```json
{"model": "gpt_image_2_5", "aspect_ratio": "4:5", "quality": "high", "resolution": "2k",
 "medias": [{"value": "{썸네일 media_id}", "role": "image_references"}]}
```

## 머리말

모든 프롬프트 맨 앞:
```
Korean mobile landing page section panel, vertical 4:5, flat graphic web design (not a photo, not a mockup, fill the whole frame).
```

**LIGHT** (1·3·5장):
```
Match the visual style of the reference image: soft mint-to-peach pastel gradient paper background with fine grain, ultra-bold black Korean gothic typography, teal #14907F accents, cute hand-drawn black-outline doodle robots, gray #8F8987 rectangular box with white text. No real brand logos. LIGHT section. Centered layout, all Korean text rendered exactly and legibly.
```
히어로에는 `Match the visual style of the reference image exactly:`로 시작하고 `a peeled paper corner at top right,` 와 `teal #14907F letter-spaced English label,`을 추가한다.

**DARK** (2·4장):
```
Same brand style as the reference image (ultra-bold Korean gothic, teal #14907F accents, cute hand-drawn doodle robot) but DARK section: deep charcoal #2A2A2E background with fine grain, white text, doodle illustrations drawn with white outlines. No real brand logos. Centered layout, all Korean text rendered exactly and legibly.
```

## 1. 히어로
```
Top: teal widely letter-spaced text "FREE SPECIAL CLASS #{NN}". Under it a small rounded outline pill in teal: "줌 실시간 라이브".
Subtitle in black, two lines, medium-bold: "{부제1}" / "{부제2}".
Huge ultra-bold black main title: "{메인 타이틀}".
Center: {썸네일 속 로봇 묘사 + 주제 소품. 예: the cute doodle robot with antenna holding a paintbrush, painting on a canvas, with a few small hand-drawn photo frames floating around it (no text inside them)}.
Below: gray rectangular box with white text: "{YYYY.MM.DD(요일)} 저녁 9시~10시".
Under it two rounded white pills with teal outline: "선착순 100명 무료" and "2주 다시보기 제공".
Bottom small dark gray text: "강사 아는디자이너".
```

## 2. 이런 분께 추천해요 (DARK)
```
Top: small rounded teal pill with white text "이런 분께 추천해요".
Headline, white, ultra-bold, two lines: "{줄1}" / "{줄2}" with "{강조}" on a teal #14907F highlight box.
Below: four white rounded chat-bubble cards with dark text, alternating slightly left and right like a messenger conversation:
"{말풍선1}"
"{말풍선2}"
"{말풍선3}"
"{말풍선4}"
Bottom right: the cute doodle robot (white outline) {waving / smiling}.
Bottom centered bold white text: "{안심 문구}".
```

## 3. 이날 배우는 것 (LIGHT)
```
Top: small rounded teal pill with white text "이날 배우는 것".
Headline, black, ultra-bold, two lines: "{줄1}" / "{줄2}" with "{강조}" on a teal highlight box with white text.
Below: three white rounded cards stacked vertically with soft shadow. Each card has a teal label chip on the left, a bold dark title, a one-line gray description, and a small hand-drawn doodle on the right:
"PART 01" — "{제목1}" — "{설명1}" — doodle: {아이콘1, 실습형은 before arrow after}
"PART 02" — "{제목2}" — "{설명2}" — doodle: {아이콘2}
"PART 03" — "{제목3}" — "{설명3}" — doodle: {아이콘3}
Bottom: a gray #8F8987 rectangular bar with white bold text: "{강조 바 문구}".
```

## 4. 진행 안내 (DARK)
```
Top: small rounded teal pill with white text "진행 안내".
Headline, white, ultra-bold, two lines: "줌으로 편하게" / "집에서 참여하세요" with "집에서" on a teal highlight box.
Below: one large white rounded card with five list rows separated by thin lines; bold teal labels on the left and dark values on the right:
"일시" — "{YYYY.MM.DD(요일)} 21:00~22:00"
"방식" — "줌 실시간 라이브"
"정원" — "선착순 100명 (무료)"
"다시보기" — "라이브 참여 시 2주간 제공"
"강사" — "아는디자이너"
Below: small white heading "준비물", then two square white rounded cards side by side, each with a small doodle icon and a bold dark label: plain laptop doodle with a smiley screen — "챗GPT 계정"; plain laptop doodle with a star screen — "제미나이 계정". Under them a small teal pill: "무료 계정도 OK".
Bottom small light gray note: "{주석}".
```

## 5. 신청 안내 (LIGHT)

같은 달 특강이 2개일 때:
```
Top headline, black, ultra-bold, two lines: "{줄1}" / "{줄2}" with "{강조}" on a teal highlight box with white text.
Middle: two white rounded cards side by side.
Left card has a {thick teal border and a small teal badge "이번 강의" | thin gray border and a small gray badge "지난주"}; inside: {teal|gray} bold "#{NN}", ultra-bold black "{타이틀}", gray "{MM.DD(요일)} 저녁 9시", and a tiny doodle robot {소품}.
Right card has a {thin gray border and a small gray badge "다음 주" | thick teal border and a small teal badge "이번 강의"}; inside: {gray|teal} bold "#{NN}", ultra-bold black "{타이틀}", gray "{MM.DD(요일)} 저녁 9시", and a tiny doodle robot {소품}.
Below: big black bold text two lines: "{M}월 {D}일 {요일}요일 밤 9시," / "줌에서 만나요!".
Bottom: a gray #8F8987 flat rectangular box (not a button) with white text: "페이지의 '강의신청'을 눌러 신청해주세요".
Small cute doodle robots waving at the bottom corners.
```

단독 특강이면 카드를 하나만 가운데에 크게 두고, 헤드라인을 "1시간이면 충분해요!" 등으로 바꾼다. 마지막 두 블록(큰 글씨, 회색 박스)은 그대로 둔다.
