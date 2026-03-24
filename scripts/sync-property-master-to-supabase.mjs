import fs from 'node:fs/promises';
import path from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const INPUT_FILE = path.resolve('public/property-master.json');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Supabase 환경변수가 필요합니다. SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY를 확인해주세요.');
}

const text = await fs.readFile(INPUT_FILE, 'utf-8');
const master = JSON.parse(text);

function normalizeText(v) { return String(v || '').trim(); }
function normalizeSearch(v) { return normalizeText(v).toLowerCase().replace(/\s+/g, ' '); }
function flattenMaster(master) {
  const rows = [];
  let sort = 1;
  for (const [propertyType, cityMap] of Object.entries(master || {})) {
    for (const [city, entries] of Object.entries(cityMap || {})) {
      for (const entry of entries || []) {
        const areas = Array.isArray(entry.areas) && entry.areas.length ? entry.areas : [null];
        for (const area of areas) {
          rows.push({
            property_type: propertyType,
            city: normalizeText(city),
            district: normalizeText(entry.district),
            town: normalizeText(entry.town),
            apartment: normalizeText(entry.apartment),
            apartment_search: normalizeSearch(entry.apartment),
            area: normalizeText(area) || null,
            kapt_code: normalizeText(entry.kaptCode) || null,
            bjd_code: normalizeText(entry.bjdCode) || null,
            sort_order: sort++,
          });
        }
      }
    }
  }
  return rows;
}

async function rest(pathname, { method='GET', query='', body, prefer } = {}) {
  const url = `${SUPABASE_URL}/rest/v1${pathname}${query ? `?${query}` : ''}`;
  const res = await fetch(url, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const txt = await res.text();
  const data = txt ? JSON.parse(txt) : null;
  if (!res.ok) throw new Error(data?.message || data?.error || `Supabase REST 실패 (${res.status})`);
  return data;
}

const rows = flattenMaster(master);
console.log(`전송 대상 행 수: ${rows.length}`);
await rest('/property_master', { method: 'DELETE', query: 'id=not.is.null' });
console.log('기존 property_master 데이터 삭제 완료');

for (let i = 0; i < rows.length; i += 1000) {
  const batch = rows.slice(i, i + 1000);
  await rest('/property_master', { method: 'POST', body: batch, prefer: 'return=minimal' });
  console.log(`업로드 ${Math.min(i + 1000, rows.length)}/${rows.length}`);
}
console.log('property_master Supabase 업로드 완료');
