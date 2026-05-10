# 소형주 공시 레이더 — 프론트엔드

대한민국 소형주(시총 3,000억 미만) 공시를 실시간으로 모니터링하고 AI로 분석하는 웹앱.  
Next.js 기반 PWA로 구현되어 Android 앱으로 래핑 예정.

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router, TypeScript) |
| 스타일 | Tailwind CSS v4 |
| PWA | Web Push API + Service Worker |
| 백엔드 | FastAPI (dart-crawler 리포) |

---

## 주요 기능

### 탭 구성
| 탭 | 설명 |
|----|------|
| 공시 | 최근 공시 피드, AI 분석, 소형주/동전주/거래정지 필터, 정렬, 공시 유형 필터 |
| 영업실적 | 실적 공시, 날씨 아이콘, 어닝쇼크 판정, 컨센서스 비교 |
| 세력 포착 | 알림 이력, 회사별 그룹, ★ 관심 기능, 심각도/종목/정렬 필터, D+1/D+5/D+10 성과 배지, **알림 설정** |
| 포트폴리오 | 보유 종목 등록 → 최근 30일 공시 즉시 확인 |
| 즐겨찾기 | 공시 즐겨찾기 / 실적 즐겨찾기 서브탭 |
| 캘린더 | 월별 달력 — 날짜별 공시 건수 표시, 날짜 클릭 시 공시 목록 |
| 검색 | 회사명 검색 (상장사+비상장사) |

### 피드 기능
- **공시 유형 필터** — 전환사채 / 유상증자 / 자기주식 / 주요사항 / 지분변동 선택 필터
- **무한 스크롤** — 스크롤 하단 도달 시 자동으로 다음 10건 표시 (IntersectionObserver)
- **소형주 필터** — 시총 3,000억 이하 / 동전주(1,000원 이하) 필터
- **거래정지 필터** — 거래정지 예정 / 거래정지 중 종목만 표시
- **정렬** — 최신순 / 상승순 / 하락순 / 가격순

### 포트폴리오
- 회사명 검색으로 종목 등록 (localStorage 저장)
- 등록 종목별 최근 30일 공시 자동 로드
- 종목 삭제 기능

### 알림 커스터마이징
- 세력 포착 탭 우상단 ⚙ 설정 버튼
- 공시 유형별 ON/OFF — 전환사채, 유상증자, 자기주식, 주요사항, 지분변동
- 추가 필터 — 포트폴리오 종목만 / 소형주만
- 설정 즉시 저장 (localStorage), 알림 피드에 실시간 반영

### 기타
- **종목 상세 모달** — 카드의 [상세] 버튼 → 바텀시트 팝업
  - 90일 공시 이력 (AI 분석 점수 포함)
  - 관련 뉴스 10건
  - 세력 포착 이력
  - 네이버 금융 차트 링크
- **PWA 푸시 알림** — 세력 포착 알림을 브라우저 푸시로 수신
  - 헤더 🔔/🔕 버튼으로 ON/OFF
  - Service Worker + VAPID 기반
- **알림 성과 추적** — D+1/D+5/D+10 주가 변동 자동 기록
- **라이트/다크 모드** — ☀️/🌙 토글, localStorage 유지
- **PWA 아이콘** — 192×192, 512×512, Apple Touch Icon(180), Favicon(32) 포함

---

## 실행 방법

```bash
npm install
npm run dev       # http://localhost:3000
```

백엔드(dart-crawler)도 함께 실행해야 합니다:
```bash
# dart-crawler 디렉토리에서
python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

### 아이콘 재생성 (SVG 변경 시)
```bash
node scripts/gen-icons.mjs
```

---

## 환경 변수

`.env.local` 파일 생성:
```
NEXT_PUBLIC_API_URL=http://localhost:8001
```

---

## 컴포넌트 구조

```
components/
├── CompanyCard.tsx              # 공시 카드 (인라인 공시/뉴스 탭)
├── CompanyDetailModal.tsx       # 종목 상세 바텀시트 모달
├── DisclosureCard.tsx           # 단일 공시 아이템
├── EarningsDashboard.tsx        # 영업실적 탭
├── AlertFeed.tsx                # 알림 벨 + AlertItem 타입
├── AlertsTab.tsx                # 세력 포착 전체 탭 (알림 설정 포함)
├── CalendarTab.tsx              # 월별 공시 캘린더
├── PortfolioTab.tsx             # 포트폴리오 탭
├── NotificationSettingsModal.tsx # 알림 커스터마이징 모달
├── MarketCapBadge.tsx           # 시총 대비 배지
├── PushToggle.tsx               # PWA 푸시 알림 ON/OFF
└── ThemeToggle.tsx              # 라이트/다크 모드 전환

hooks/
└── useInfiniteScroll.ts         # IntersectionObserver 무한 스크롤 훅

scripts/
└── gen-icons.mjs                # SVG → PNG 아이콘 생성 스크립트

public/
├── icon.svg                     # 마스터 아이콘 (레이더 테마)
├── icon-192.png                 # PWA 아이콘
├── icon-512.png                 # PWA 아이콘 (마스커블)
├── apple-touch-icon.png         # iOS 홈화면 아이콘
├── favicon-32.png               # 브라우저 탭 파비콘
├── manifest.json                # PWA 매니페스트
└── sw.js                        # Service Worker
```

---

## 배포 계획

1. Vercel 배포 (`NEXT_PUBLIC_API_URL` → Railway 백엔드 URL로 설정)
2. Capacitor로 Android 앱 래핑 → Google Play Store 제출
