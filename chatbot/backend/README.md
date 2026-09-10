# 소문 상담 API

고객정보 접수부터 총판 접수함, 처리 상태, 접수 삭제, 90일 자동 파기까지 담당하는 Cloudflare Worker + D1 백엔드입니다. 이름·연락처·설치 주소는 AES-256-GCM으로 암호화하고, 대화 원문은 저장하지 않습니다.

## 운영 관문

다음 값이 모두 준비되어야 `/api/status`가 `available: true`를 반환합니다.

- `OPERATIONS_ENABLED=true`
- `PRIVACY_CONTACT`: 개인정보 문의 담당 연락처
- D1 `partners`: 실제 제휴 총판의 정확한 사업자명 1곳 이상
- `DATA_ENCRYPTION_KEY`: 32바이트 base64 키
- `TOKEN_PEPPER`, `RATE_LIMIT_SALT`, `OPS_ADMIN_TOKEN`: Wrangler secret

명단과 문의처가 비어 있으면 고객 화면은 상품 검토만 허용하며 접수 API는 503으로 닫힙니다.

## 처음 배포

```powershell
npm install
npx wrangler d1 create somun-chatbot
# 출력된 database_id를 wrangler.toml에 반영
npx wrangler d1 migrations apply somun-chatbot --remote
npx wrangler secret put DATA_ENCRYPTION_KEY
npx wrangler secret put TOKEN_PEPPER
npx wrangler secret put RATE_LIMIT_SALT
npx wrangler secret put OPS_ADMIN_TOKEN
npx wrangler deploy
```

운영 전에는 `tools/partner-registry-to-sql.mjs`로 고객이 확인한 명단을 SQL로 변환하고 D1에 적용합니다. 발급된 총판 접속키는 화면에 한 번만 표시되며 원문을 DB에 저장하지 않습니다.
