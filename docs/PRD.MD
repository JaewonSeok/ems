교육 관리 시스템 (EMS) — PRD v1.0

프로젝트명:

2026 교육 관리 시스템 (Education Management System)

작성일:

2026-02-19

배포 대상:

전 직원 + 관리자

기술 스택:

React + TypeScript + Vite (프론트엔드) / Node.js + Express (백엔드) / PostgreSQL (DB) /AWS EC2 (배포)

목차

1\.

시스템 개요

2\.

사용자 역할 정의

3\.

Phase 1 — 기반 구축 (인증 · DB · 프로젝트 골격)

4\.

Phase 2 — 핵심 기능 구현 (교육 CRUD · 대시보드 · 업로드)

5\.

Phase 3 — 고도화 및 배포 (통계 · 알림 · 보안 · AWS 배포)

6\.

데이터베이스 스키마

7\.

API 엔드포인트 목록

8\.

Cline/Claude Code용 프롬프트 가이드

시스템 개요

본 시스템은 기존 스프레드시트/엑셀 기반 교육 관리를 웹 애플리케이션으로 전환하여, 사외교육·사내교육·사내강의·자격증 데이터를 통합 관리하고, 수료증 업로드/승인 워크플로우, 부서별·카테고리별 통계 시각화,엑셀 일괄 업로드 기능을 제공하는 것을 목표로 합니다.

핵심 목표

교육 이력의 중앙 집중화 및 실시간 조회

수료증 제출→승인/반려 워크플로우 디지털화

부서별·월별·카테고리별 통계 자동 생성

엑셀 일괄 업로드로 기존 데이터 마이그레이션 지원

마스터(관리자)와 직원 개인 계정 분리 운영

사용자 역할 정의

역할 설명 주요 권한

마스터

(ADMIN)

시스템 관

리자

전체 대시보드 조회, 모든 교육 데이터 CRUD, 수료증 승인/반려, 사용자 관리, 일괄 업

로드, 계정 초기화, 통계 전체 조회

직원 (USER) 일반 사용

자

자기 교육 이력 조회/등록/수정, 수료증 업로드, 자기 통계 조회, 비밀번호 변경

Phase 1 — 기반 구축

목표: 프로젝트 뼈대, 인증 시스템, DB 설계, 기본 레이아웃 완성

예상 기간: 1~2주

완료 기준: 로그인/로그아웃 동작, 사이드바 레이아웃 렌더링, DB 마이그레이션 완료

1.1 프로젝트 초기화

프론트엔드 (React + TypeScript + Vite)

백엔드 (Node.js + Express + TypeScript)

dashboard-app/

├── src/

│ ├── api/ # Axios 인스턴스, API 호출 함수

│ ├── components/ # 공용 컴포넌트 (Button, Modal, Table, Card ...)

│ │ ├── ui/ # 기본 UI 컴포넌트

│ │ ├── layout/ # Sidebar, TopBar, MainLayout

│ │ └── shared/ # SearchBar, FileUpload, Pagination

│ ├── pages/ # 페이지 컴포넌트

│ │ ├── Login.tsx

│ │ ├── ChangePassword.tsx

│ │ ├── Dashboard.tsx

│ │ ├── ExternalTraining.tsx # 사외교육

│ │ ├── InternalTraining.tsx # 사내교육

│ │ ├── InternalLecture.tsx # 사내강의

│ │ ├── Certification.tsx # 자격증

│ │ ├── Statistics.tsx # 통계

│ │ ├── AllRecords.tsx # 전체 이력 관리

│ │ ├── UserManagement.tsx # 사용자 관리

│ │ └── BulkUpload.tsx # 일괄 업로드

│ ├── hooks/ # 커스텀 훅 (useAuth, useTable ...)

│ ├── store/ # 전역 상태 (Zustand 또는 Context)

│ ├── types/ # TypeScript 타입/인터페이스

│ ├── utils/ # 유틸 함수 (날짜 포맷, 엑셀 파싱 ...)

│ ├── App.tsx

│ └── main.tsx

├── public/

├── tailwind.config.js

├── vite.config.ts

└── package.json

설치할 핵심 패키지:

구분

패키지

프론트

react-router-dom, axios, zustand, recharts, xlsx(SheetJS), lucide-react, tailwindcss,@tanstack/react-table

백엔드

express, prisma, @prisma/client, bcryptjs, jsonwebtoken, multer, cors, dotenv, xlsx, express-validator

1.2 인증 시스템 (로그인/비밀번호)

로그인 플로우:

server/

├── src/

│ ├── config/ # DB 연결, 환경변수

│ ├── middleware/ # auth, errorHandler, upload(multer)

│ ├── routes/ # 라우트 정의

│ ├── controllers/ # 비즈니스 로직

│ ├── models/ # DB 모델 (Prisma 또는 TypeORM)

│ ├── services/ # 엑셀 파싱, 통계 계산 등

│ ├── utils/ # JWT 헬퍼, 비밀번호 해싱

│ └── app.ts

├── prisma/

│ └── schema.prisma # DB 스키마

├── uploads/ # 수료증 파일 저장

├── templates/ # 엑셀 업로드 템플릿

├── .env

└── package.json

인증 상세 요구사항:

항목

설명

초기 비밀번호

사번 (예: EMP001)

첫 로그인 시

비밀번호 변경 페이지로 자동 리다이렉트

비밀번호 규칙

8자 이상, 영문+숫자+특수문자 조합 (권장)

계정 초기화

마스터가 \[사용자 관리]에서 특정 직원의 비밀번호를 사번으로 재설정 + is\_first\_login = true

세션 관리

JWT Access Token (1시간) + Refresh Token (7일)

로그아웃

토큰 삭제, 로그인 페이지로 이동

1.3 기본 레이아웃

MainLayout 구성 (대시보드 스크린샷 기반):

\[로그인 페이지]

│

├─ ID: 이메일 주소

├─ PW: 입력

│

▼

\[서버 인증]

│

├─ 첫 로그인 여부 확인 (is\_first\_login = true?)

│ ├─ YES → \[비밀번호 변경 페이지]로 강제 이동

│ │ └─ 새 비밀번호 설정 완료 → is\_first\_login = false → \[대시보드]

│ └─ NO → 역할 확인

│ ├─ ADMIN → \[대시보드] (전체 통계)

│ └─ USER → \[내 교육 이력] (개인 뷰)

│

▼

\[JWT 토큰 발급] → localStorage 저장 → Axios 인터셉터로 자동 첨부

사이드바 메뉴 구조:

메뉴

경로

권한

대시보드

/dashboard

ADMIN

사외교육

/external-training

ALL

사내교육

/internal-training

ALL

사내강의

/internal-lecture

ALL

자격증

/certification

ALL

통계

/statistics

ALL (ADMIN=전체, USER=개인)

전체 이력 관리

/all-records

ADMIN

사용자 관리

/user-management

ADMIN

일괄 업로드

/bulk-upload

ADMIN

1.4 데이터베이스 설계

핵심 테이블:

users (사용자)

 

┌──────────────────────────────────────────────────

│ 교육 관리 시스템 관리자(ADMIN001) 로그아웃 │ ← TopBar

├────────┬─────────────────────────────────────────

│ 🏠 대시보드 │ │

│ 📋 사외교육 │ \[메인 콘텐츠 영역] │

│ 📋 사내교육 │ │

│ 🎓 사내강의 │ 각 페이지 컴포넌트가 렌더링됨 │

│ 📜 자격증 │ │

│ 📊 통계 │ │

│ 📑 전체이력 │ │

│ 👥 사용자 │ │

│ ⬆️ 일괄업로드 │ │

└────────┴─────────────────────────────────────────

컬럼

타입

설명

id

UUID

PK

email

VARCHAR(255)

로그인 ID (이메일)

password\_hash

VARCHAR(255)

bcrypt 해시

employee\_id

VARCHAR(50)

사번 (초기 비밀번호)

name

VARCHAR(100)

이름

department

VARCHAR(100)

부서

team

VARCHAR(100)

팀

role

ENUM('ADMIN','USER')

역할

is\_first\_login

BOOLEAN

첫 로그인 여부 (기본 true)

is\_active

BOOLEAN

활성 상태

created\_at

TIMESTAMP

생성일

updated\_at

TIMESTAMP

수정일

external\_trainings (사외교육)

컬럼

타입

설명

id

UUID

PK

user\_id

UUID

FK → users

training\_name

VARCHAR(255)

교육명

type

ENUM('OFFLINE','ONLINE')

구분

start\_date

DATE

시작일

end\_date

DATE

종료일

hours

DECIMAL(6,1)

교육시간

cost

INTEGER

비용 (원)

institution

VARCHAR(255)

주관기관

certificate\_status

ENUM('SUBMITTED','NOT\_SUBMITTED')

수료증 제출 여부

certificate\_file

VARCHAR(500)

수료증 파일 경로

approval\_status

ENUM('PENDING','APPROVED','REJECTED')

승인 상태

approval\_comment

TEXT

승인/반려 사유

approved\_by

UUID

승인자 FK → users

approved\_at

TIMESTAMP

승인일시

credits

DECIMAL(4,1)

인정 학점

created\_at

TIMESTAMP

생성일

updated\_at

TIMESTAMP

수정일

internal\_trainings (사내교육)

컬럼

타입

설명

id

UUID

PK

user\_id

UUID

FK → users

training\_name

VARCHAR(255)

교육명

type

ENUM('OFFLINE','ONLINE')

구분

start\_date

DATE

시작일

end\_date

DATE

종료일

hours

DECIMAL(6,1)

교육시간

institution

VARCHAR(255)

주관기관

certificate\_status

ENUM('SUBMITTED','NOT\_SUBMITTED')

수료증 제출 여부

certificate\_file

VARCHAR(500)

수료증 파일 경로

credits

DECIMAL(4,1)

인정 학점

created\_at

TIMESTAMP

생성일

updated\_at

TIMESTAMP

수정일

internal\_lectures (사내강의)

컬럼

타입

설명

id

UUID

PK

user\_id

UUID

FK → users

lecture\_name

VARCHAR(255)

강의명

type

ENUM('OFFLINE','ONLINE')

구분

start\_date

DATE

시작일

end\_date

DATE

종료일

hours

DECIMAL(6,1)

강의시간

department\_instructor

VARCHAR(255)

주관부서(강사명)

credits

DECIMAL(4,1)

인정 학점

created\_at

TIMESTAMP

생성일

updated\_at

TIMESTAMP

수정일

certifications (자격증)

컬럼

타입

설명

id

UUID

PK

user\_id

UUID

FK → users

cert\_name

VARCHAR(255)

자격증명

grade

VARCHAR(100)

등급

acquired\_date

DATE

취득일

credits

DECIMAL(4,1)

인정 학점

created\_at

TIMESTAMP

생성일

updated\_at

TIMESTAMP

수정일

Phase 2 — 핵심 기능 구현

목표:

4개 카테고리 CRUD, 대시보드, 검색/필터, 수료증 워크플로우, 일괄 업로드

예상 기간:

2~3주

완료 기준:

모든 카테고리의 등록/조회/수정/삭제 동작, 대시보드 차트 렌더링, 엑셀 업로드 성공

2.1 대시보드 (마스터 전용 첫 화면)

스크린샷 기반으로 다음 4개 영역으로 구성:

상단 KPI 카드 4개:

카드

데이터

색상

총 교육 건수

전체 교육 레코드 수 (4개 테이블 합산)

연한 파랑 배경

총 교육 시간

전체 교육시간 합계 (시간 단위)

연한 초록 배경

총 인정 학점

전체 학점 합계 (점 단위)

연한 회색/기본 배경

수료증 미제출

certificate\_status = 'NOT\_SUBMITTED' 건수

연한 빨강 배경

월별 교육 시간 막대 차트 (recharts BarChart):

X축: 1월~12월

Y축: 교육 시간 (합계)

데이터: 해당 연도의 월별 교육시간 집계

카테고리별 교육 건수 도넛 차트 (recharts PieChart):

사외교육 (파랑), 사내교육 (초록), 사내강의 (주황)

중앙 빈 공간이 있는 도넛 형태

부서별 현황 테이블:

부서

교육 건수

교육 시간

인정 학점

경영지원본부

39

396

46.5

국내영업총괄본부

49

316

39

...

...

...

...

2.2 사외교육 페이지

화면 구성:

테이블 컬럼 상세:

 

┌──────────────────────────────────────────────────

│ 사외교육 │

│ │

│ \[🔍 교육명/이름 검색] \[+ 사외교육 등록] 버튼 │

│ │

│┌──────────────────────────────────────────────────│

│ │ 이름 │교육명│구분│시작일│종료일│시간│비용│주관기관│수료증│ │ │

│ │ │ │ │ │ │ │ │ │승인상태│ │ │

│ │ │ │ │ │ │ │ │ │학점 │ │ │

│ │ │ │ │ │ │ │ │ │관리 │ │ │

│├──────────────────────────────────────────────────│

│ │ 김철수│AI교육│OFF│01-05│01-10│40 │50만│삼성SDS│제출 │ │ │

│ │ │ │ │ │ │ │ │ │승인 │ │ │

│ │ │ │ │ │ │ │ │ │5.0 │ │ │

│ │ │ │ │ │ │ │ │ │📎⬇️✏️🗑️│ │ │

│└──────────────────────────────────────────────────│

│ │

│ \[◀ 1 2 3 4 5 ▶] 페이지네이션 │

└──────────────────────────────────────────────────

컬럼

설명

비고

이름

교육 이수자 이름

users.name 조인

교육명

교육 과정명

\-

구분

오프라인/온라인

뱃지 형태

시작일

YYYY-MM-DD

\-

종료일

YYYY-MM-DD

\-

교육시간

숫자 (시간)

\-

비용

원 단위 (천 단위 콤마)

\-

주관기관

교육 주관 기관명

\-

수료증

제출 / 미제출

뱃지 (초록/빨강)

승인 상태

대기 / 승인 / 반려

뱃지 (노랑/초록/빨강)

학점

인정 학점

\-

관리

아이콘 4개

📎업로드 ⬇️다운로드 ✏️수정 🗑️삭제

수료증 승인/반려 워크플로우 (마스터 전용):

"+ 사외교육 등록" 모달 폼 필드:

직원이 수료증 파일 업로드

→ certificate\_status = 'SUBMITTED'

→ approval\_status = 'PENDING'

▼

마스터가 \[수료증 보기] 클릭

→ 파일 미리보기 모달 표시

→ \[승인] 또는 \[반려] 버튼

▼

승인 시: approval\_status = 'APPROVED', approved\_by, approved\_at 기록

반려 시: approval\_status = 'REJECTED', approval\_comment에 사유 입력

→ 직원에게 반려 사유 표시

필드

타입

필수

이름

드롭다운 (사용자 목록) / 마스터:선택, 직원:자동

✅

교육명

텍스트

✅

구분

라디오 (오프라인/온라인)

✅

시작일

Date Picker

✅

종료일

Date Picker

✅

교육시간

숫자 입력

✅

비용

숫자 입력 (원)

\-

주관기관

텍스트

✅

수료증 파일

파일 업로드 (.pdf, .jpg, .png)

\-

학점

숫자 입력

\-

2.3 사내교육 페이지

사외교육과 동일한 레이아웃. 차이점:

항목

차이

비용 컬럼

❌ 없음

승인 상태 컬럼

❌ 없음

수료증

있음 (업로드/다운로드만, 승인 워크플로우 없음)

등록 버튼

"+ 사내교육 등록"

2.4 사내강의 페이지

컬럼

설명

이름

강의 이수자/강사 이름

강의명

강의 과정명

구분

오프라인/온라인

시작일

YYYY-MM-DD

컬럼

설명

종료일

YYYY-MM-DD

강의시간

숫자 (시간)

주관부서(강사명)

부서명 + 강사명

학점

인정 학점

관리

✏️

수정 🗑️삭제 (수료증 업로드 없음)

등록 버튼: "+ 사내강의 등록"

2.5 자격증 페이지

컬럼

설명

이름

취득자 이름

부서

소속 부서

팀

소속 팀

자격증명

자격증 이름

등급

자격증 등급 (1급, 2급 등)

취득일

YYYY-MM-DD

인정학점

학점

관리

✏️

수정 🗑️삭제

등록 버튼: "+ 자격증 등록"

2.6 공통 기능: 검색 및 필터

검색바 (좌측 상단, 모든 카테고리 페이지 공통):

검색 대상: 교육명(또는 강의명/자격증명), 이름

입력 시 실시간 필터링 (debounce 300ms)

검색어 하이라이트 (선택)

2.7 전체 이력 관리

통합 테이블 컬럼:

컬럼

설명

이름

\-

부서

\-

팀

\-

카테고리

사외교육/사내교육/사내강의/자격증 (뱃지)

교육명

교육명 또는 강의명 또는 자격증명

구분

오프라인/온라인

시작일

\-

종료일

\-

시간

교육시간/강의시간

비용

사외교육만 해당, 나머지 "-"

수료증

제출/미제출/해당없음

학점

\-

관리

📎업로드 ⬇️다운로드 🗑️삭제

카테고리 필터 (검색창 우측):

드롭다운 또는 탭 형태: 전체 / 사외교육 / 사내교육 / 사내강의 / 자격증

선택 시 해당 카테고리만 표시

정렬 기능:

각 컬럼 헤더 클릭 시 오름차순/내림차순 정렬

이름, 부서, 카테고리, 시작일, 학점 등 주요 컬럼

2.8 사용자 관리 (마스터 전용)

기능 목록:

기능

설명

\+ 사용자 추가

모달: 이름, 이메일, 사번, 부서, 팀, 역할 입력 → 계정 생성 (초기 PW=사번)

사용자 목록

테이블: 이름, 이메일, 사번, 부서, 팀, 역할, 상태, 관리

계정 초기화

관리 컬럼의 🔄 아이콘 → 비밀번호를 사번으로 리셋 + is\_first\_login = true

비활성화

관리 컬럼의 🚫 아이콘 → 계정 비활성화 (삭제 대신)

템플릿 다운로드

사용자 일괄 등록용 엑셀 템플릿 (.xlsx) 다운로드

일괄 업로드

작성된 엑셀 파일 업로드 → 사용자 일괄 생성

사용자 일괄 등록 엑셀 템플릿 컬럼:

이름

이메일

사번

부서

팀

역할(ADMIN/USER)

2.9 일괄 업로드 (스크린샷 2 기반)

화면 구성 (3단계 UI):

카테고리별 엑셀 템플릿 컬럼:

사외교육:

사번, 교육명, 구분(오프라인/온라인), 시작일, 종료일, 교육시간, 비용, 주관기관, 학점

사내교육:

사번, 교육명, 구분, 시작일, 종료일, 교육시간, 주관기관, 학점

 

┌──────────────────────────────────────────────────

│ 엑셀 일괄 업로드 │

│ │

│ 1. 카테고리 선택 │

│ ┌──────────┬──────────┬──────────┬──────────┐│

│ │ \[사외교육] │ 사내교육 │ 사내강의 │ 자격증 │ │

│ └──────────┴──────────┴──────────┴──────────┘│

│ │

│ 2. 템플릿 다운로드 │

│ 아래 버튼을 클릭하여 엑셀 템플릿을 다운로드한 후, │

│ 데이터를 입력하세요. │

│ ┌──────────────────────┐ │

│ │ 📥 사외교육 템플릿 다운로드 │ │

│ └──────────────────────┘ │

│ │

│ 3. 파일 업로드 │

│┌──────────────────────────────────────────────┐│

│ │ │ │

│ │ ☁️ 엑셀 파일을 선택하세요 │ │

│ │ (.xlsx, .xls) │ │

│ │ │ │

│└──────────────────────────────────────────────┘│

│ │

│ ┌─────────┐ │

│ │ 일괄 등록 │ │

│ └─────────┘ │

│ │

│ ⚠️ 안내사항 │

│ - 사번은 반드시 시스템에 등록된 사번이어야 합니다. │

│ - 날짜는 YYYY-MM-DD 형식으로 입력해주세요. │

│ - 엑셀 파일의 첫 번째 행은 헤더로 사용되므로, │

│ 두 번째 행부터 데이터를 입력하세요. │

│ - 최대 파일 크기는 10MB입니다. │

└──────────────────────────────────────────────────

사내강의:

사번, 강의명, 구분, 시작일, 종료일, 강의시간, 주관부서(강사명), 학점

자격증:

사번, 자격증명, 등급, 취득일, 인정학점

업로드 처리 로직:

Phase 3 — 고도화 및 배포

목표:

통계 시각화, 추가 기능, 보안 강화, AWS 배포

예상 기간:

1~2주

완료 기준:

통계 페이지 완성, EC2 배포 후 외부 접속 가능

3.1 통계 페이지

차트 구성 (recharts 기반):

차트

유형

설명

월별 교육 시간 추이

BarChart

1~12월 교육 시간 합계 (대시보드와 동일)

카테고리별 교육 건수

PieChart (도넛)

사외/사내/강의/자격증 비율

부서별 교육 참여율

BarChart (가로)

부서별 건수/시간/학점 비교

월별 교육 비용 추이

LineChart

사외교육 비용 월별 추이

구분별 비율 (온/오프)

PieChart

온라인 vs 오프라인 비율

수료증 제출 현황

BarChart (스택)

제출/미제출/승인/반려 건수

직원별 교육 시간 TOP 10

BarChart (가로)

교육 시간 상위 10명

연도별 비교

BarChart (그룹)

전년도 vs 올해 비교 (선택)

필터:

파일 업로드 → 확장자 검증(.xlsx, .xls) → 크기 검증(10MB)

→ SheetJS로 파싱 → 헤더 검증 (필수 컬럼 존재 여부)

→ 행별 유효성 검사:

\- 사번이 users 테이블에 존재하는지

\- 날짜 형식 (YYYY-MM-DD)

\- 필수값 누락 여부

\- 숫자 필드 유효성

→ 결과:

✅ 성공: N건 등록 완료

❌ 실패: 에러 행 번호 + 사유 표시

(예: "3행: 사번 'EMP999' 미등록", "5행: 시작일 형식 오류")

기간 선택 (Year Picker 또는 Date Range)

부서 선택 (드롭다운)

카테고리 선택 (체크박스)

3.2 추가 편의 기능

기능

설명

엑셀 다운로드

각 테이블 데이터를 .xlsx로 내보내기 (우측 상단 📥 아이콘)

페이지네이션

10/20/50건 선택, 페이지 이동

반응형 UI

태블릿/모바일 최소 대응 (사이드바 접기)

토스트 알림

등록/수정/삭제/업로드 성공·실패 알림

확인 모달

삭제 시 "정말 삭제하시겠습니까?" 확인

로딩 스피너

API 호출 중 로딩 표시

빈 상태 UI

데이터 없을 때 안내 메시지 + 등록 유도

3.3 보안

항목

구현

비밀번호 해싱

bcrypt (saltRounds: 12)

JWT

Access (1h) + Refresh (7d)

RBAC 미들웨어

라우트별 역할 체크

파일 업로드 제한

10MB, 허용 확장자만 (.xlsx, .xls, .pdf, .jpg, .png)

입력 유효성

express-validator로 서버 사이드 검증

CORS

허용 origin 제한

Helmet

HTTP 보안 헤더

Rate Limiting

express-rate-limit (로그인 5회/분)

.env 보호

.gitignore 필수

3.4 AWS EC2 배포

서버 구성:

배포 절차:

\[인터넷]

│

▼ (포트 80/443)

\[Nginx] ─── 리버스 프록시

│

├── / (정적 파일) → /var/www/dashboard-app/dist/

│ (Vite 빌드 결과물)

│

├── /api/\* → http://localhost:4000

│ (Express 백엔드, PM2로 관리)

│

└── /uploads/\* → /var/www/dashboard-app/uploads/

(수료증 파일 서빙)

bash

Nginx 설정 예시:

\# 1. EC2 접속

ssh

-i key.pem ubuntu@

<

EC2\_IP

>

\# 2. 기본 패키지 설치

sudo

apt

update

\&\&

sudo

apt

upgrade -y

curl

-fsSL https://deb.nodesource.com/setup\_20.x

|

sudo

-E

bash

\-

sudo

apt

install

-y nodejs nginx postgresql

\# 3. PM2 설치

sudo

npm

install

-g pm2

\# 4. 코드 배포

git

clone

<

REPO\_URL

>

/var/www/dashboard-app

cd

/var/www/dashboard-app

\# 5. 프론트엔드 빌드

npm

install

npm

run build

\# → dist/ 폴더 생성

\# 6. 백엔드 설정

cd

server

npm

install

cp

.env.example .env

\# DB 접속 정보, JWT\_SECRET 등 설정

npx prisma migrate deploy

\# DB 마이그레이션

\# 7. PM2로 백엔드 실행

pm2 start src/app.ts --name dashboard-api

pm2 save

pm2 startup

\# 재부팅 시 자동 시작

\# 8. Nginx 설정

sudo

nano

/etc/nginx/sites-available/dashboard

nginx

3.5 PostgreSQL 설정

server

{

listen

80

;

server\_name

\_

;

\# 프론트엔드 정적 파일

root

/var/www/dashboard-app/dist

;

index

index.html

;

\# SPA 라우팅 (새로고침 시 404 방지)

location

/

{

try\_files

$uri

$uri

/ /index.html

;

}

\# API 리버스 프록시

location

/api/

{

proxy\_pass

http://localhost:4000

;

proxy\_http\_version

1.1

;

proxy\_set\_header

Upgrade

$http\_upgrade

;

proxy\_set\_header

Connection

'upgrade'

;

proxy\_set\_header

Host

$host

;

proxy\_cache\_bypass

$http\_upgrade

;

}

\# 업로드 파일 서빙

location

/uploads/

{

alias

/var/www/dashboard-app/uploads/

;

}

\# 파일 업로드 크기 제한

client\_max\_body\_size

10M

;

}

bash

\# Nginx 활성화

sudo

ln

-s /etc/nginx/sites-available/dashboard /etc/nginx/sites-enabled/

sudo

nginx -t

sudo

systemctl restart nginx

\# AWS 보안그룹: 인바운드 규칙에 80, 443, 22(SSH) 허용

bash

server/.env 예시:

API 엔드포인트 목록

인증

Method

Endpoint

설명

POST

/api/auth/login

로그인

POST

/api/auth/refresh

토큰 갱신

POST

/api/auth/logout

로그아웃

PUT

/api/auth/change-password

비밀번호 변경

사용자

Method

Endpoint

설명

GET

/api/users

사용자 목록 (ADMIN)

POST

/api/users

사용자 추가 (ADMIN)

PUT

/api/users/:id

사용자 수정 (ADMIN)

PUT

/api/users/:id/reset-password

비밀번호 초기화 (ADMIN)

PUT

/api/users/:id/deactivate

비활성화 (ADMIN)

\# DB 생성

sudo

-u postgres psql

CREATE DATABASE education\_db

;

CREATE

USER

ems\_user WITH PASSWORD

'your\_secure\_password'

;

GRANT ALL PRIVILEGES ON DATABASE education\_db TO ems\_user

;

\\

q

env

DATABASE\_URL="postgresql://ems\_user:your\_secure\_password@localhost:5432/education\_db"

JWT\_SECRET="your\_jwt\_secret\_key\_here"

JWT\_REFRESH\_SECRET="your\_refresh\_secret\_here"

PORT=4000

UPLOAD\_DIR="./uploads"

MAX\_FILE\_SIZE=10485760

Method

Endpoint

설명

POST

/api/users/bulk-upload

사용자 일괄 등록 (ADMIN)

GET

/api/users/template

사용자 템플릿 다운로드 (ADMIN)

사외교육

Method

Endpoint

설명

GET

/api/external-trainings

목록 조회 (검색, 페이지네이션)

POST

/api/external-trainings

등록

PUT

/api/external-trainings/:id

수정

DELETE

/api/external-trainings/:id

삭제

POST

/api/external-trainings/:id/certificate

수료증 업로드

GET

/api/external-trainings/:id/certificate

수료증 다운로드

PUT

/api/external-trainings/:id/approve

승인 (ADMIN)

PUT

/api/external-trainings/:id/reject

반려 (ADMIN)

사내교육

Method

Endpoint

설명

GET

/api/internal-trainings

목록 조회

POST

/api/internal-trainings

등록

PUT

/api/internal-trainings/:id

수정

DELETE

/api/internal-trainings/:id

삭제

POST

/api/internal-trainings/:id/certificate

수료증 업로드

GET

/api/internal-trainings/:id/certificate

수료증 다운로드

사내강의

Method

Endpoint

설명

GET

/api/internal-lectures

목록 조회

Method

Endpoint

설명

POST

/api/internal-lectures

등록

PUT

/api/internal-lectures/:id

수정

DELETE

/api/internal-lectures/:id

삭제

자격증

Method

Endpoint

설명

GET

/api/certifications

목록 조회

POST

/api/certifications

등록

PUT

/api/certifications/:id

수정

DELETE

/api/certifications/:id

삭제

일괄 업로드

Method

Endpoint

설명

GET

/api/bulk-upload/template/:category

카테고리별 템플릿 다운로드

POST

/api/bulk-upload/:category

엑셀 파일 업로드 및 일괄 등록

대시보드 / 통계

Method

Endpoint

설명

GET

/api/dashboard/summary

KPI 카드 데이터

GET

/api/dashboard/monthly-hours

월별 교육 시간

GET

/api/dashboard/category-count

카테고리별 건수

GET

/api/dashboard/department-summary

부서별 현황

GET

/api/statistics/overview

통계 종합 데이터

GET

/api/statistics/cost-trend

비용 추이

GET

/api/statistics/completion-rate

수료증 제출 현황

GET

/api/statistics/top-employees

직원별 교육 시간 TOP

전체 이력

Method

Endpoint

설명

GET

/api/all-records

전체 이력 통합 조회 (필터, 정렬, 페이지네이션)

GET

/api/all-records/export

전체 이력 엑셀 다운로드

Cline/Claude Code용 프롬프트 가이드

아래 프롬프트를

단계별로

복사해서 Cline 또는 Claude Code에 붙여넣으세요.

Phase 1 프롬프트 (3개)

프롬프트 1-1: 프로젝트 초기화

프롬프트 1-2: DB 스키마 + 인증

프로젝트를 다음 구조로 초기화해줘.

\[프론트엔드]

\- Vite + React + TypeScript

\- Tailwind CSS

\- react-router-dom, axios, zustand, recharts, xlsx(SheetJS),

lucide-react, @tanstack/react-table

\- src 아래 폴더: api/, components/(ui, layout, shared), pages/,

hooks/, store/, types/, utils/

\[백엔드]

\- server/ 폴더에 Express + TypeScript

\- Prisma ORM + PostgreSQL

\- bcryptjs, jsonwebtoken, multer, cors, dotenv, xlsx,

express-validator, helmet, express-rate-limit

\- src 아래 폴더: config/, middleware/, routes/, controllers/,

models/, services/, utils/

Vite의 proxy 설정으로 /api -> http://localhost:4000 연결.

모든 설정 파일(tailwind.config, vite.config, tsconfig, prisma schema)을

완성 상태로 만들어줘.

프롬프트 1-3: 레이아웃 + 라우팅

Prisma schema를 작성하고 인증 시스템을 구현해줘.

\[DB 테이블]

1\. users: id(UUID), email(unique), password\_hash, employee\_id(unique),

name, department, team, role(ADMIN/USER), is\_first\_login(default true),

is\_active(default true), created\_at, updated\_at

2\. external\_trainings: id, user\_id(FK), training\_name, type(OFFLINE/ONLINE),

start\_date, end\_date, hours, cost, institution,

certificate\_status(SUBMITTED/NOT\_SUBMITTED), certificate\_file,

approval\_status(PENDING/APPROVED/REJECTED), approval\_comment,

approved\_by(FK), approved\_at, credits, timestamps

3\. internal\_trainings: id, user\_id(FK), training\_name, type, start\_date,

end\_date, hours, institution, certificate\_status, certificate\_file,

credits, timestamps

4\. internal\_lectures: id, user\_id(FK), lecture\_name, type, start\_date,

end\_date, hours, department\_instructor, credits, timestamps

5\. certifications: id, user\_id(FK), cert\_name, grade, acquired\_date,

credits, timestamps

\[인증 시스템]

\- POST /api/auth/login: 이메일+비밀번호 → JWT 발급

\- 첫 로그인이면 { firstLogin: true } 반환 → 프론트에서 비밀번호 변경 페이지로 이동

\- PUT /api/auth/change-password: 새 비밀번호 설정 → is\_first\_login = false

\- JWT middleware: Access Token(1h) + Refresh Token(7d)

\- RBAC middleware: role 기반 접근 제어

\- PUT /api/users/:id/reset-password (ADMIN): 비밀번호를 사번으로 초기화

시드 데이터로 마스터 계정 1개 생성:

\- email: admin@company.com, employee\_id: ADMIN001, role: ADMIN

Phase 2 프롬프트 (4개)

프롬프트 2-1: 대시보드

메인 레이아웃과 라우팅을 구현해줘.

\[레이아웃]

\- MainLayout: 좌측 사이드바(240px) + 상단 TopBar + 메인 콘텐츠

\- TopBar: 좌측에 "교육 관리 시스템" 타이틀, 우측에 사용자명(역할) + 로그아웃

\- Sidebar 메뉴: 대시보드, 사외교육, 사내교육, 사내강의, 자격증, 통계,

전체 이력 관리, 사용자 관리, 일괄 업로드

\- 각 메뉴에 lucide-react 아이콘 사용

\- 현재 페이지 활성 표시 (파란색 배경)

\- ADMIN 전용 메뉴: 대시보드, 전체 이력 관리, 사용자 관리, 일괄 업로드

\[라우팅]

\- /login → 로그인 (비인증 상태에서만 접근)

\- /change-password → 비밀번호 변경

\- /dashboard → 대시보드 (ADMIN)

\- /external-training → 사외교육

\- /internal-training → 사내교육

\- /internal-lecture → 사내강의

\- /certification → 자격증

\- /statistics → 통계

\- /all-records → 전체 이력 (ADMIN)

\- /user-management → 사용자 관리 (ADMIN)

\- /bulk-upload → 일괄 업로드 (ADMIN)

\- ProtectedRoute 컴포넌트로 인증/역할 체크

\[로그인 페이지]

\- 중앙 정렬 카드: 이메일 + 비밀번호 + 로그인 버튼

\- 로그인 성공 시:

\- firstLogin === true → /change-password

\- role === ADMIN → /dashboard

\- role === USER → /external-training

각 페이지는 빈 컴포넌트(제목만)로 만들어줘.

실제 구현은 다음 단계에서 진행.

프롬프트 2-2: 사외교육 + 사내교육 + 사내강의 + 자격증

대시보드 페이지를 구현해줘 (ADMIN 전용).

\[KPI 카드 4개] - 상단 가로 배치

1\. 총 교육 건수: 4개 테이블 레코드 합계 / 연한 파랑 배경

2\. 총 교육 시간: hours 합계 / 연한 초록 배경

3\. 총 인정 학점: credits 합계 / 기본 배경

4\. 수료증 미제출: NOT\_SUBMITTED 건수 / 연한 빨강 배경

\[월별 교육 시간 - 좌측]

\- recharts BarChart, X: 1월~12월, Y: 교육 시간 합계

\- 파란색 바

\[카테고리별 교육 건수 - 우측]

\- recharts PieChart (도넛형, innerRadius=60)

\- 사외교육(파랑), 사내교육(초록), 사내강의(주황)

\- 하단에 범례

\[부서별 현황 테이블 - 하단]

\- 컬럼: 부서, 교육 건수, 교육 시간, 인정 학점

\- users.department 기준 GROUP BY

API 엔드포인트:

\- GET /api/dashboard/summary

\- GET /api/dashboard/monthly-hours?year=2026

\- GET /api/dashboard/category-count

\- GET /api/dashboard/department-summary

프롬프트 2-3: 전체 이력 관리 + 사용자 관리

4개 교육 카테고리 페이지를 구현해줘.

\[공통 구조]

\- 좌측 상단: 검색바 (교육명/이름 검색, debounce 300ms)

\- 우측 상단: "+ {카테고리명} 등록" 버튼

\- 테이블: @tanstack/react-table, 정렬, 페이지네이션(10/20/50)

\- 등록/수정: 모달 폼 (react-hook-form 권장)

\- 삭제: 확인 모달 후 삭제

\[사외교육 /external-training]

컬럼: 이름, 교육명, 구분(뱃지), 시작일, 종료일, 교육시간, 비용(천단위콤마),

주관기관, 수료증(제출/미제출 뱃지), 승인상태(대기/승인/반려 뱃지), 학점, 관리

관리: 📎수료증업로드, ⬇️다운로드, ✏️수정, 🗑️삭제

ADMIN 추가 기능: 수료증 클릭 시 미리보기 + 승인/반려 버튼 + 반려 사유 입력

\[사내교육 /internal-training]

컬럼: 이름, 교육명, 구분, 시작일, 종료일, 교육시간, 주관기관, 수료증, 학점, 관리

관리: 📎수료증업로드, ⬇️다운로드, ✏️수정, 🗑️삭제

(승인 워크플로우 없음, 비용 없음)

\[사내강의 /internal-lecture]

컬럼: 이름, 강의명, 구분, 시작일, 종료일, 강의시간, 주관부서(강사명), 학점, 관리

관리: ✏️수정, 🗑️삭제 (수료증 없음)

\[자격증 /certification]

컬럼: 이름, 부서, 팀, 자격증명, 등급, 취득일, 인정학점, 관리

관리: ✏️수정, 🗑️삭제

ADMIN은 모든 사용자 데이터 조회, USER는 자기 데이터만 조회.

각 카테고리의 CRUD API도 함께 구현해줘.

프롬프트 2-4: 일괄 업로드

전체 이력 관리와 사용자 관리 페이지를 구현해줘 (ADMIN 전용).

\[전체 이력 관리 /all-records]

\- 4개 테이블 데이터를 UNION하여 통합 조회

\- 컬럼: 이름, 부서, 팀, 카테고리(뱃지), 교육명, 구분, 시작일, 종료일,

시간, 비용, 수료증, 학점, 관리(📎⬇️🗑️)

\- 검색창 + 카테고리 필터 드롭다운(전체/사외/사내/강의/자격증)

\- 컬럼 헤더 클릭 시 정렬

\- 엑셀 다운로드 버튼

\- GET /api/all-records?search=\&category=\&sort=\&order=\&page=\&limit=

\[사용자 관리 /user-management]

\- 사용자 목록 테이블: 이름, 이메일, 사번, 부서, 팀, 역할, 상태, 관리

\- 관리: 🔄비밀번호초기화, ✏️수정, 🚫비활성화

\- "+ 사용자 추가" 버튼 → 모달: 이름, 이메일, 사번, 부서, 팀, 역할

\- "📥 템플릿 다운로드" → 사용자 일괄 등록 엑셀 템플릿

\- "📤 일괄 업로드" → 엑셀 파일로 사용자 일괄 등록

\- 업로드 결과: 성공 건수 + 실패 행(번호+사유) 표시

Phase 3 프롬프트 (3개)

프롬프트 3-1: 통계 페이지

일괄 업로드 페이지를 구현해줘 (/bulk-upload, ADMIN 전용).

\[UI 구조 - 3단계]

1\. 카테고리 선택: 4개 탭 버튼 (사외교육, 사내교육, 사내강의, 자격증)

\- 선택된 탭: 파란 테두리 + 파란 텍스트

2\. 템플릿 다운로드: 선택된 카테고리의 엑셀 템플릿 다운로드 버튼

\- 카테고리별 다른 컬럼 구성

\- SheetJS로 서버에서 .xlsx 생성하여 다운로드

3\. 파일 업로드: 드래그앤드롭 영역 + 클릭 파일 선택

\- 허용: .xlsx, .xls만

\- 최대 10MB

\- 파일 선택 시 파일명 표시

\[일괄 등록 버튼]

\- 파일 업로드 → 서버에서 파싱 + 유효성 검사

\- 사번으로 user\_id 매칭

\- 결과 모달: 성공 N건, 실패 M건 (실패 행 상세)

\[안내사항 - 하단 노란 박스]

\- 사번은 시스템에 등록된 사번이어야 합니다

\- 날짜는 YYYY-MM-DD 형식

\- 첫 행은 헤더, 두 번째 행부터 데이터

\- 최대 10MB

프롬프트 3-2: 보안 + 편의 기능

프롬프트 3-3: AWS EC2 배포

통계 페이지를 구현해줘 (/statistics).

\[필터 영역 - 상단]

\- 연도 선택 (기본: 2026)

\- 부서 선택 (전체 + 부서 목록)

\- 카테고리 선택 (체크박스: 전체, 사외교육, 사내교육, 사내강의)

\[차트 - recharts]

1\. 월별 교육 시간 추이 (BarChart) - 전체 너비

2\. 카테고리별 교육 건수 (PieChart 도넛) + 구분별 비율 온/오프 (PieChart) - 2열

3\. 부서별 교육 참여 비교 (가로 BarChart) - 전체 너비

4\. 월별 교육 비용 추이 (LineChart) - 전체 너비

5\. 수료증 제출 현황 (스택 BarChart) + 직원별 교육 시간 TOP 10 (가로 BarChart) - 2열

각 차트는 Card 컴포넌트로 감싸고, 제목 표시.

API는 필터 파라미터를 받아서 집계 결과 반환.

ADMIN: 전체 통계, USER: 자기 통계만.

다음 기능들을 추가해줘.

\[보안]

\- helmet 미들웨어 적용

\- express-rate-limit: 로그인 5회/분, API 100회/분

\- 파일 업로드: multer로 확장자+크기 검증

\- 모든 입력에 express-validator 적용

\- CORS origin 제한 (환경변수)

\[편의 기능]

\- 모든 테이블에 엑셀 다운로드 버튼 (📥)

→ SheetJS로 현재 필터/검색 결과를 .xlsx 다운로드

\- 토스트 알림 (성공: 초록, 에러: 빨강, 경고: 노랑)

\- 삭제 확인 모달: "정말 삭제하시겠습니까?" + 취소/삭제

\- 로딩: 페이지 전환 시 스켈레톤 로더, API 호출 시 스피너

\- 빈 상태: "등록된 데이터가 없습니다." + 등록 버튼

\- 에러 바운더리: 예상치 못한 에러 시 안내 페이지

\[직원(USER) 전용 대시보드 위젯] (선택)

\- 내 총 교육 시간 / 학점 / 수료증 미제출 건수

\- 최근 등록 교육 5건

부록: 주의사항 및 팁

데이터 마이그레이션 (기존 엑셀 → 새 시스템):

기존에 사용하던 스프레드시트/엑셀 데이터는 일괄 업로드 기능으로 이전할 수 있습니다. 다만, 기존 엑셀의 컬럼명이 시스템 템플릿과 다를 수 있으므로, 컬럼 매핑 로직을백엔드에 구현하거나, 기존 데이터를 템플릿 형식에 맞춰 정리한 후 업로드하세요.

Cline/Claude Code 사용 팁:

한 번에 모든 것을 요청하지 말고, 위의 프롬프트 순서대로 단계별 진행

각 단계 완료 후 반드시

npm run dev

로 동작 확인

에러 발생 시 에러 메시지를 그대로 복사해서 "이 에러 해결해줘"로 요청

디자인 수정은 스크린샷을 함께 보내며 "이 부분을 이렇게 바꿔줘"로 요청

백엔드 API 테스트는 Thunder Client(VS Code 확장) 또는 Postman 사용

향후 확장 고려:

HTTPS 적용 (Let's Encrypt + Certbot)

이메일 알림 (수료증 승인/반려 시)

교육 신청/승인 워크플로우

AWS EC2에 배포하기 위한 설정을 만들어줘.

\[빌드 스크립트]

\- 프론트: npm run build → dist/

\- 백엔드: TypeScript 컴파일 또는 ts-node 사용

\[PM2 ecosystem 파일]

\- server/ecosystem.config.js 생성

\- 환경변수 .env에서 로드

\[Nginx 설정 파일]

\- / → dist/ 정적 파일 서빙 (SPA fallback)

\- /api/ → localhost:4000 리버스 프록시

\- /uploads/ → 업로드 파일 서빙

\- client\_max\_body\_size 10M

\- gzip 압축

\[배포 스크립트]

\- deploy.sh: git pull → npm install → build → prisma migrate → pm2 restart

\- 처음 세팅용 setup.sh: Node, Nginx, PostgreSQL, PM2 설치 스크립트

\[환경변수 템플릿]

\- server/.env.example 작성

연간 교육 계획 관리

교육 이수 목표 설정 및 달성률

모바일 앱 (React Native)

