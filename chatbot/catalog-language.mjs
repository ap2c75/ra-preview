import {categoryFromText} from '/ra-preview/chatbot/taxonomy.mjs';
const BRANDS = {
  '코웨이': ['코웨이', 'coway'],
  'SK매직': ['sk매직', 'sk 매직', '에스케이매직', 'skmagic'],
  '교원웰스': ['교원웰스', '웰스', 'wells', '교원'],
  '청호나이스': ['청호나이스', '청호', 'chungho'],
  '쿠쿠': ['쿠쿠', 'cuckoo'],
  '세스코': ['세스코', 'cesco'],
  '동양': ['동양매직', '동양렌탈'],
  'BS렌탈': ['bs렌탈', '비에스렌탈'],
  'UBUS환경가전': ['유버스', 'ubus'],
  '캐리어': ['캐리어', 'carrier'],
  '루헨스': ['루헨스', 'ruhens'],
};


const MAKERS = ['삼성', '삼성전자', 'LG', 'LG전자', '스타리온', '라셀르', '그랜드우성', '하이얼',
  '다이슨', '테라', '위니아', '캐리어', '한일', '신일'];



const norm = s => String(s ?? '').replace(/\s+/g, '').toLowerCase();

export function findBrand(text) {
  const t = norm(text);
  for (const [name, aliases] of Object.entries(BRANDS)) {
    if (aliases.some(a => t.includes(norm(a)))) return name;
  }
  return null;
}


export function findMaker(text) {
  const t = norm(text);
  
  return [...MAKERS].sort((a, b) => b.length - a.length).find(m => t.includes(norm(m))) ?? null;
}

export const findCategory = categoryFromText;

