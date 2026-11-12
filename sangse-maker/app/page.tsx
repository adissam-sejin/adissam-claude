import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { Showcase } from "@/components/Showcase";
import { CHANNELS } from "@/lib/channels";

const STEPS = [
  { t: "사진 올리기", d: "스마트폰으로 찍은 사진 한 장이면 충분해요. AI가 사진을 보고 상품 정보를 자동으로 채워요." },
  { t: "기획 초안 확인", d: "업종과 타깃에 맞는 판매 흐름을 먼저 보여드려요. 마음에 들 때까지 순서와 메시지를 바꿀 수 있어요." },
  { t: "상세페이지 생성", d: "후킹 → 공감 → 해결 → 근거 → 구매 유도. 설득 구조에 맞춘 카피와 디자인이 한 번에 완성돼요." },
  { t: "고치고 내보내기", d: "글자를 클릭해 직접 고치거나 \"더 짧게\"처럼 말로 수정하세요. 채널 규격으로 바로 저장돼요." },
];

const FEATURES = [
  { ic: "AI", t: "사진 → 정보 자동 채우기", d: "사진만 올리면 카테고리, 특징, 타깃, 핵심 판매 포인트(USP)까지 AI가 먼저 제안해요." },
  { ic: "기획", t: "전환 구조 기획 초안", d: "본 생성 전에 섹션 구성과 핵심 메시지를 확인하고 자유롭게 바꿔요." },
  { ic: "카피", t: "팔리는 카피라이팅", d: "기능이 아니라 고객이 얻는 결과로 말해요. 근거 없는 과장 표현은 쓰지 않아요." },
  { ic: "말", t: "말로 고치는 섹션 수정", d: "섹션을 고르고 \"20대 말투로\", \"더 고급스럽게\"처럼 요청하면 그 부분만 바뀌어요." },
  { ic: "색", t: "스타일 템플릿 + 브랜드 컬러", d: "클린·프리미엄·비비드·내추럴 4가지 분위기에 브랜드 컬러 하나로 전체 톤을 맞춰요." },
  { ic: "규격", t: "채널별 규격 내보내기", d: "스마트스토어, 쿠팡, 토스쇼핑 등 채널 폭에 맞춰 섹션별 조각과 전체 이미지로 저장해요." },
];

const FAQ = [
  { q: "사진이 잘 안 나왔는데 괜찮을까요?", a: "네. 밝은 곳에서 상품 전체가 보이게 찍은 사진이면 충분해요. 여러 각도의 사진을 함께 올리면 디테일 섹션이 더 풍부해져요." },
  { q: "만든 뒤에 수정할 수 있나요?", a: "모든 글자를 클릭해서 바로 고칠 수 있고, 섹션 추가·삭제·순서 변경, 사진 교체, 컬러 변경, AI 말로 수정까지 모두 가능해요. 되돌리기도 지원해요." },
  { q: "어떤 형식으로 저장되나요?", a: "선택한 채널 폭에 맞춘 JPG 또는 PNG로, 섹션별 조각 이미지와 한 장짜리 전체 이미지를 묶어 zip으로 내려받아요." },
  { q: "AI가 사실과 다른 내용을 쓰면 어떡하죠?", a: "AI는 확인되지 않은 수치·인증·후기를 지어내지 않도록 설계되어 있고, 필요한 곳은 [입력] 자리표시로 남겨요. 그래도 등록 전에 내용을 꼭 검수해 주세요." },
  { q: "작업한 내용은 어디에 저장되나요?", a: "작업 중인 프로젝트는 사용 중인 브라우저에 자동 저장돼요. 다른 기기에서 이어 하려면 내보낸 이미지를 활용해 주세요." },
];

export default function Home() {
  return (
    <>
      <TopBar />
      <main>
        <section className="hero">
          <div className="container">
            <span className="tag tag-brand">사진 한 장 + 장점 몇 줄</span>
            <h1>
              기획·카피·디자인까지
              <br />
              <em>AI가 한 번에</em> 만드는 상세페이지
            </h1>
            <p className="lead">
              외주 맡기면 몇 주, 직접 하면 막막했던 상세페이지.
              <br />
              이제 상품 사진만 올리고 몇 분 안에 초안을 받아보세요.
            </p>
            <div className="hero-ctas">
              <Link href="/create" className="btn btn-primary btn-lg">내 상품으로 무료 제작하기</Link>
              <a href="#how" className="btn btn-lg">어떻게 만들어지나요?</a>
            </div>
            <div style={{ marginTop: 56 }}>
              <Showcase />
            </div>
          </div>
        </section>

        <section className="section alt">
          <div className="container">
            <span className="kicker">이런 고민 있으셨죠</span>
            <h2>상세페이지가 늘 숙제였다면</h2>
            <p className="sub">셀러라면 한 번쯤 해봤을 고민, 상세메이트가 대신 풀어 드려요.</p>
            <div className="pains">
              <div className="pain">어떤 문구로 시작해야 할지 모르겠어요</div>
              <div className="pain">쓸 만한 상품 사진이 몇 장 없어요</div>
              <div className="pain">디자인 툴은 켜기만 해도 막막해요</div>
              <div className="pain">외주는 비용도 시간도 부담돼요</div>
            </div>
          </div>
        </section>

        <section className="section" id="how">
          <div className="container">
            <span className="kicker">HOW IT WORKS</span>
            <h2>4단계면 끝나요</h2>
            <p className="sub">기획 초안을 먼저 확인하고 만들기 때문에, 원하는 방향에서 벗어나지 않아요.</p>
            <div className="steps3">
              {STEPS.map((s, i) => (
                <div key={i} className="step3">
                  <div className="no">STEP {i + 1}</div>
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section alt" id="features">
          <div className="container">
            <span className="kicker">FEATURES</span>
            <h2>만들기부터 고치기, 내보내기까지</h2>
            <p className="sub">상세페이지 제작에 필요한 과정을 한 화면에서 끝내요.</p>
            <div className="feat-grid">
              {FEATURES.map((f) => (
                <div key={f.t} className="feat">
                  <div className="ic">{f.ic}</div>
                  <h3>{f.t}</h3>
                  <p>{f.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <span className="kicker">MULTI CHANNEL</span>
            <h2>한 번 만들고, 여러 채널에 등록</h2>
            <p className="sub">채널을 고르면 가로 폭에 맞춰 자동으로 저장돼요.</p>
            <table className="channel-table">
              <tbody>
                {CHANNELS.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.width}px</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="section alt">
          <div className="container">
            <span className="kicker">COST</span>
            <h2>시간과 비용을 비교해 보세요</h2>
            <p className="sub">기획자, 카피라이터, 디자이너가 하던 일을 한 번에.</p>
            <div className="compare2">
              <div className="box">
                <span className="tag">외주 제작</span>
                <div className="big">수십만 원~</div>
                <p className="muted" style={{ margin: 0 }}>기획·촬영·디자인 의뢰, 수정 요청 왕복까지 보통 1~2주</p>
              </div>
              <div className="box win">
                <span className="tag tag-brand">상세메이트</span>
                <div className="big">몇 분</div>
                <p className="muted" style={{ margin: 0 }}>사진 업로드부터 초안까지 한자리에서, 수정은 무제한</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="faq">
          <div className="container">
            <span className="kicker">FAQ</span>
            <h2>자주 묻는 질문</h2>
            <div className="faq-list" style={{ marginTop: 36 }}>
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="section alt" style={{ textAlign: "center" }}>
          <div className="container">
            <h2>사진 한 장만 올려 보세요</h2>
            <p className="sub">결과물을 보고 판단하셔도 늦지 않아요.</p>
            <Link href="/create" className="btn btn-primary btn-lg">지금 무료로 만들어 보기</Link>
          </div>
        </section>
      </main>
      <footer className="footer">
        <div className="container">
          © 상세메이트 · AI가 생성한 콘텐츠는 등록 전 반드시 사실 여부를 검수해 주세요.
        </div>
      </footer>
    </>
  );
}
