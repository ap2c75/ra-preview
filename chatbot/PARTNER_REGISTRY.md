# 제휴 총판 명단 운영

정본은 `api/partner-registry.json`입니다. 실제 접수를 열기 전에 모든 제휴 총판의 정확한 사업자명과 적용 시작일을 등록합니다. 연락처나 고객정보는 이 파일에 넣지 않습니다.

각 총판은 다음 값을 가집니다.

- `id`: 변경되지 않는 내부 식별자
- `name`: 고객에게 공개할 정확한 사업자명
- `purpose`: 제공 목적
- `retentionDays`: 현재 확정값 `90`
- `effectiveFrom`: 명단 적용 시작 시각
- `effectiveUntil`: 종료 시각 또는 `null`

새 명단 파일을 준비한 뒤 먼저 변경 내용을 확인합니다.

```powershell
node chatbot/tools/update-partner-registry.mjs .\new-partners.json
```

추가·삭제·변경 항목이 맞으면 정본을 갱신합니다.

```powershell
node chatbot/tools/update-partner-registry.mjs .\new-partners.json --write
```

갱신할 때마다 버전을 바꿔야 하며, 이전 버전부터 추가·삭제·변경된 총판 ID와 변경 시각이 `history`에 누적됩니다. 고객 동의 증적에는 정책 버전, 명단 버전, 동의 당시 제공 대상 사업자명이 함께 저장됩니다.
