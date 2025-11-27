# 💬 실시간 채팅 애플리케이션

카카오톡과 같은 실시간 채팅 기능을 제공하는 웹 애플리케이션입니다.

## 🚀 주요 기능

### 👤 사용자 기능
- 회원가입 및 로그인 (JWT 인증)
- 프로필 관리 (닉네임 변경)
- 사용자 검색

### 💬 채팅 기능
- **1:1 채팅**: 두 명의 사용자 간 개인 대화
- **그룹 채팅**: 3명 이상의 사용자가 참여하는 그룹 대화
- **실시간 메시지**: WebSocket을 통한 실시간 메시지 송수신
- **읽음 처리**: 메시지 읽음 상태 표시
- **타이핑 표시**: 상대방이 입력 중일 때 표시
- **미읽은 메시지 카운트**: 각 채팅방별 미읽은 메시지 수 표시

### 🎨 사용자 경험
- **반응형 디자인**: PC/모바일 웹 환경 모두 지원
- **실시간 알림**: 새 메시지 도착 시 즉시 표시
- **직관적인 UI**: 카카오톡과 유사한 친숙한 인터페이스

## 🛠 기술 스택

### Backend
- **Node.js** - 서버 런타임
- **Express.js** - 웹 프레임워크
- **Socket.IO** - 실시간 통신
- **PostgreSQL** - 데이터베이스
- **JWT** - 인증
- **bcryptjs** - 비밀번호 암호화

### Frontend
- **Vue 3** - 프론트엔드 프레임워크
- **Vite** - 빌드 도구
- **Pinia** - 상태 관리
- **Vue Router** - 라우팅
- **Socket.IO Client** - 실시간 통신
- **Axios** - HTTP 클라이언트

## 📋 사전 요구사항

- Node.js 18+ 
- PostgreSQL 12+
- npm 또는 yarn

## ⚙️ 설치 및 실행

### 1. 프로젝트 클론
```bash
git clone <repository-url>
cd chat
```

### 2. PostgreSQL 데이터베이스 설정
PostgreSQL에서 새 데이터베이스를 생성합니다:
```sql
CREATE DATABASE chat_db;
```

### 3. 백엔드 설정
```bash
cd backend
npm install
```

환경 변수 파일 생성 (`.env`):
```env
# 서버 설정
PORT=3001
NODE_ENV=development

# JWT 설정
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# 데이터베이스 설정
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chat_db
DB_USER=postgres
DB_PASSWORD=your-password

# CORS 설정
FRONTEND_URL=http://localhost:3000
```

### 4. 프론트엔드 설정
```bash
cd ../frontend
npm install
```

### 5. 애플리케이션 실행

**백엔드 서버 실행:**
```bash
cd backend
npm run dev
```
서버가 http://localhost:3001 에서 실행됩니다.

**프론트엔드 개발 서버 실행:**
```bash
cd frontend
npm run dev
```
애플리케이션이 http://localhost:3000 에서 실행됩니다.

## 📁 프로젝트 구조

```
chat/
├── backend/                 # 백엔드 소스코드
│   ├── config.js           # 환경 설정
│   ├── server.js           # 메인 서버 파일
│   ├── database/           # 데이터베이스 관련
│   │   └── db.js          # DB 연결 및 스키마
│   ├── middleware/         # 미들웨어
│   │   └── auth.js        # JWT 인증 미들웨어
│   ├── routes/            # API 라우터
│   │   ├── auth.js        # 인증 관련 API
│   │   ├── users.js       # 사용자 관련 API
│   │   ├── rooms.js       # 채팅방 관련 API
│   │   └── messages.js    # 메시지 관련 API
│   └── socket/            # WebSocket 관련
│       └── socketHandler.js # 소켓 이벤트 처리
├── frontend/               # 프론트엔드 소스코드
│   ├── src/
│   │   ├── components/    # Vue 컴포넌트
│   │   ├── views/         # 페이지 컴포넌트
│   │   │   ├── Login.vue  # 로그인 페이지
│   │   │   ├── Register.vue # 회원가입 페이지
│   │   │   └── Chat.vue   # 메인 채팅 페이지
│   │   ├── stores/        # Pinia 스토어
│   │   │   ├── auth.js    # 인증 상태 관리
│   │   │   └── chat.js    # 채팅 상태 관리
│   │   ├── router/        # Vue Router 설정
│   │   └── main.js        # 앱 진입점
│   └── package.json
└── README.md
```

## 🗄 데이터베이스 스키마

### users (사용자)
- `id` - 사용자 고유 ID
- `email` - 이메일 (중복 불가)
- `password_hash` - 암호화된 비밀번호
- `nickname` - 닉네임
- `profile_image` - 프로필 이미지 URL (선택)
- `created_at` - 가입일시

### rooms (채팅방)
- `id` - 채팅방 고유 ID
- `type` - 채팅방 타입 ('1:1' 또는 'group')
- `title` - 그룹 채팅방 제목
- `created_at` - 생성일시

### room_members (채팅방 참가자)
- `room_id` - 채팅방 ID
- `user_id` - 사용자 ID
- `joined_at` - 참가일시

### messages (메시지)
- `id` - 메시지 고유 ID
- `room_id` - 채팅방 ID
- `sender_id` - 발신자 ID
- `type` - 메시지 타입 ('text', 'image', 'file', 'system')
- `content` - 메시지 내용
- `created_at` - 전송일시

### read_messages (읽음 처리)
- `message_id` - 메시지 ID
- `user_id` - 사용자 ID
- `read_at` - 읽은 일시

## 🔧 개발 모드

### 백엔드 개발
```bash
cd backend
npm run dev  # nodemon으로 자동 재시작
```

### 프론트엔드 개발
```bash
cd frontend
npm run dev  # Vite 개발 서버 (HMR 지원)
```

## 🚀 프로덕션 배포

### 백엔드
```bash
cd backend
npm start
```

### 프론트엔드
```bash
cd frontend
npm run build  # dist 폴더에 빌드 파일 생성
npm run preview  # 빌드된 파일 미리보기
```

## 🎯 사용 방법

1. **회원가입**: 이메일, 닉네임, 비밀번호로 계정 생성
2. **로그인**: 이메일과 비밀번호로 로그인
3. **새 채팅 시작**: 
   - 좌측 상단의 ➕ 버튼 클릭
   - 사용자 검색 후 선택하여 1:1 채팅 시작
4. **메시지 전송**: 하단 입력창에 메시지 입력 후 Enter 또는 전송 버튼
5. **실시간 채팅**: 상대방과 실시간으로 메시지 주고받기

## 🔒 보안 기능

- JWT 토큰 기반 인증
- 비밀번호 bcrypt 암호화
- CORS 설정
- Rate Limiting
- SQL Injection 방지 (Parameterized Queries)

## 📱 반응형 지원

- 데스크톱: 사이드바와 채팅 영역이 나란히 표시
- 모바일: 사이드바가 오버레이로 표시되며 햄버거 메뉴로 토글

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 ISC 라이선스 하에 있습니다.

## 🐛 문제 해결

### 일반적인 문제들

**1. 데이터베이스 연결 오류**
- PostgreSQL 서비스가 실행 중인지 확인
- 데이터베이스 연결 정보가 올바른지 확인
- 데이터베이스가 존재하는지 확인

**2. 포트 충돌**
- 3000번 포트(프론트엔드) 또는 3001번 포트(백엔드)가 이미 사용 중인 경우
- 다른 포트로 변경하거나 해당 프로세스 종료

**3. WebSocket 연결 실패**
- 백엔드 서버가 실행 중인지 확인
- CORS 설정이 올바른지 확인
- 방화벽 설정 확인

더 자세한 문제 해결은 Issues 탭에서 확인하거나 새로운 이슈를 등록해 주세요.
