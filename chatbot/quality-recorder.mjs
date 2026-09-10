import { mask } from '/ra-preview/chatbot/detect.mjs';

export const QUALITY_REASONS = [
  ['repeat', '질문 반복'],
  ['misread', '의도 오인식'],
  ['insufficient', '답변 부족'],
  ['recommendation', '상품 추천 문제'],
];

const clean = value => mask(String(value || '').trim().slice(0, 500), { profile: 'storage' }).masked;

export function createQualityRecorder({ limit = 20 } = {}) {
  let records = [];
  return {
    add({ reason, userText, assistantText, context = {} }) {
      const record = {
        reason,
        user: clean(userText),
        assistant: clean(assistantText),
        context: {
          filters: Array.isArray(context.filters) ? context.filters.slice(0, 10) : [],
          awaiting: context.awaiting || null,
          selectedCount: Number(context.selectedCount || 0),
        },
      };
      records = [...records, record].slice(-limit);
      return record;
    },
    all() { return records.map(record => structuredClone(record)); },
    clear() { records = []; },
    exportText() {
      return [
        '# 소문 챗봇 대화 개선 기록',
        '',
        '서버에 저장하지 않고 현재 브라우저 창에서 복사한 검토용 기록입니다.',
        '',
        ...records.flatMap((record, index) => [
          `## ${index + 1}. ${record.reason}`,
          `- 고객 발화: ${record.user || '(없음)'}`,
          `- 챗봇 답변: ${record.assistant || '(없음)'}`,
          `- 당시 조건: ${record.context.filters.join(' · ') || '없음'}`,
          `- 대기 질문: ${record.context.awaiting || '없음'}`,
          `- 담은 상품 수: ${record.context.selectedCount}`,
          '',
        ]),
      ].join('\n').trim();
    },
  };
}
