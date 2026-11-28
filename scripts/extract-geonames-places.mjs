import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const outFile = path.join(repoRoot, 'src', 'agent', 'hosts', 'names', 'geonamesPlaces.json');

const DUMP_URL = 'https://download.geonames.org/export/dump/';
const FILES = { cities: 'cities500.zip', admin1: 'admin1CodesASCII.txt', admin2: 'admin2Codes.txt' };

const VILLAGE_MAX = 5000;
const TOWN_MAX = 50000;
const BAND_CAPS = { city: 50, town: 100, village: 100 };
const SETTLEMENT_CAP = 250;
const REGION_CAP = 40;
const MAX_WORDS = 3;
const MAX_NAME_LENGTH = 30;

// Same ids as NAME_ORIGINS in suggestNames.ts. A language area inside a country lists its admin1 codes.
// plain: accents stripped, for romanizations whose marks read as noise in English text.
const ORIGINS = [
  { id: 'afrikaans', areas: [{ country: 'ZA', admin1: ['11', '08', '03'] }] },
  { id: 'american', areas: [{ country: 'US' }] },
  { id: 'australian', areas: [{ country: 'AU' }] },
  { id: 'azerbaijani', areas: [{ country: 'AZ' }] },
  { id: 'brazilian', areas: [{ country: 'BR' }] },
  { id: 'british', areas: [{ country: 'GB' }] },
  { id: 'croatian', areas: [{ country: 'HR' }] },
  { id: 'czech', areas: [{ country: 'CZ' }] },
  { id: 'danish', areas: [{ country: 'DK' }] },
  { id: 'dutch', areas: [{ country: 'NL' }] },
  { id: 'finnish', areas: [{ country: 'FI' }] },
  { id: 'flemish', areas: [{ country: 'BE', admin1: ['VLG'] }] },
  { id: 'french', areas: [{ country: 'FR' }] },
  { id: 'german', areas: [{ country: 'DE' }] },
  { id: 'ghanaian', areas: [{ country: 'GH' }] },
  { id: 'hungarian', areas: [{ country: 'HU' }] },
  { id: 'indian', areas: [{ country: 'IN' }], plain: true },
  { id: 'indonesian', areas: [{ country: 'ID' }] },
  { id: 'italian', areas: [{ country: 'IT' }] },
  { id: 'japanese', areas: [{ country: 'JP' }], plain: true },
  {
    id: 'kurdish',
    areas: [
      { country: 'IQ', admin1: ['11', '08', '05', '19'] },
      { country: 'TR', admin1: ['65', '62', '74', '49', '72', '70', '21', '13', '04', '02', '76', '80'] },
    ],
    plain: true,
  },
  { id: 'latvian', areas: [{ country: 'LV' }] },
  { id: 'mexican', areas: [{ country: 'MX' }] },
  { id: 'moldovan', areas: [{ country: 'MD' }] },
  { id: 'nepali', areas: [{ country: 'NP' }], plain: true },
  { id: 'nigerian', areas: [{ country: 'NG' }] },
  { id: 'norwegian', areas: [{ country: 'NO' }] },
  { id: 'polish', areas: [{ country: 'PL' }] },
  { id: 'portuguese', areas: [{ country: 'PT' }] },
  { id: 'romanian', areas: [{ country: 'RO' }] },
  { id: 'senegalese', areas: [{ country: 'SN' }] },
  { id: 'serbian', areas: [{ country: 'RS' }] },
  { id: 'slovak', areas: [{ country: 'SK' }] },
  { id: 'slovene', areas: [{ country: 'SI' }] },
  { id: 'south-african', areas: [{ country: 'ZA' }] },
  { id: 'spanish', areas: [{ country: 'ES' }] },
  { id: 'swedish', areas: [{ country: 'SE' }] },
  { id: 'swiss-french', areas: [{ country: 'CH', admin1: ['VD', 'GE', 'NE', 'JU'] }] },
  {
    id: 'swiss-german',
    areas: [
      {
        country: 'CH',
        admin1: ['ZH', 'ZG', 'UR', 'SO', 'SZ', 'SH', 'SG', 'OW', 'NW', 'LU', 'GL', 'BS', 'BL', 'AR', 'AI', 'AG', 'TG', 'BE'],
      },
    ],
  },
  { id: 'turkish', areas: [{ country: 'TR' }] },
  { id: 'uzbek', areas: [{ country: 'UZ' }] },
  { id: 'vietnamese', areas: [{ country: 'VN' }] },
  { id: 'yoruba', areas: [{ country: 'NG', admin1: ['32', '48', '16', '05', '42', '54', '30'] }] },
  { id: 'zulu', areas: [{ country: 'ZA', admin1: ['02'] }] },
];

// PPLX is a neighbourhood; PPLH, PPLQ, PPLW, PPLCH are historical, abandoned, destroyed, or a former capital.
const SETTLEMENT_CODES = new Set(['PPL', 'PPLA', 'PPLA2', 'PPLA3', 'PPLA4', 'PPLA5', 'PPLC', 'PPLF', 'PPLG', 'PPLL', 'PPLS', 'STLMT']);

const NAME_PATTERN = /^\p{Script=Latin}[\p{Script=Latin}\p{M}]*(?:[ '’‘ʻ-]\p{Script=Latin}[\p{Script=Latin}\p{M}]*)*$/u;

const DROP_WORDS =
  /(?<!\p{L})(district|municipality|township|region|province|county|area|rayon|industrial|estate|colony|cantonment|camp|census|subdivision|sector|zone|block|ward|asireti|bolgesi|aşireti|bölgesi)(?!\p{L})/iu;

const SETTLEMENT_STRIP = [
  /^(thị trấn|thị xã|thi tran|thi xa|xã|phường|xóm|ấp|ap)\s+/iu,
  /\s+(shahri|shahar|shaharchasi|qishlog[’'‘]i)$/i,
  /-(shi|chō|cho|machi|mura|son)$/i,
];

// Elsewhere these are GeoNames' English translations (Rishiri Town, Town of Komiža, Basel-City), not the local name.
const ENGLISH_ORIGINS = new Set(['afrikaans', 'american', 'australian', 'british', 'ghanaian', 'indian', 'nigerian', 'south-african', 'yoruba', 'zulu']);
const ENGLISH_GENERIC = [/^(town|city|village) of\s+/i, /[\s-]+(town|city|village)$/i];

const REGION_STRIP = [
  /^(urban municipality of|municipality of|city of|city and borough of|borough of|county of|raionul|comuna|gmina|powiat|kabupaten|kota|distrito de|provincia di|provincia de|province de|province of|provincie|département de|département du|département des|landkreis|kreis|bezirk|regierungsbezirk|arrondissement de|arrondissement d’|arrondissement d'|huyện|quận|thành phố|thị xã|huyen|quan|thanh pho|thi xa)\s+/iu,
  /\s+(county|district|province|region|rayon|state|municipality|municipal|metropolitan|novads|rajons|shire|prefecture|oblast|governorate|department|municipio|kommune|kommun|regional unit|city|sub-province|borough|parish|division|ilçesi|İlçesi|ilcesi|tumani|shahri|shi|gun|ku)$/iu,
  /-(ken|shi|gun|to|fu|do)$/iu,
];

function splitTsv(text) {
  return text.split('\n').filter(Boolean).map((line) => line.replace(/\r$/, '').split('\t'));
}

// FNV-1a. Picks a spread of names that stays the same between runs, instead of the first N alphabetically.
function hash(text) {
  let h = 0x811c9dc5;
  for (const char of text) {
    h ^= char.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function plain(name) {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .replace(/[łŁ]/g, (char) => (char === 'ł' ? 'l' : 'L'))
    .replace(/[đĐ]/g, (char) => (char === 'đ' ? 'd' : 'D'))
    .normalize('NFC');
}

function strip(name, patterns) {
  let out = name;
  let previous;
  do {
    previous = out;
    for (const pattern of patterns) out = out.replace(pattern, '').trim();
  } while (out !== previous);
  return out.replace(/\s+/g, ' ');
}

function cleanName(raw, patterns) {
  if (!raw || /[\d/().,&]/.test(raw)) return null;
  const name = strip(raw.normalize('NFC'), patterns);
  if (!name || name.length > MAX_NAME_LENGTH || name.split(' ').length > MAX_WORDS) return null;
  if (DROP_WORDS.test(name) || !NAME_PATTERN.test(name)) return null;
  return name;
}

function inArea(areas, country, admin1) {
  return areas.some((area) => area.country === country && (!area.admin1 || area.admin1.includes(admin1)));
}

function band(population) {
  if (population < VILLAGE_MAX) return 'village';
  if (population < TOWN_MAX) return 'town';
  return 'city';
}

function spread(names, cap) {
  return [...names].sort((a, b) => hash(a) - hash(b) || a.localeCompare(b)).slice(0, cap);
}

function pickSettlements(rows) {
  const byBand = { city: [], town: [], village: [] };
  const seen = new Set();
  for (const row of [...rows].sort((a, b) => b.population - a.population)) {
    const key = row.name.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    byBand[band(row.population)].push(row.name);
  }
  const picked = {};
  for (const [name, cap] of Object.entries(BAND_CAPS)) picked[name] = spread(byBand[name], cap);
  // A small country's empty city band leaves room for more towns and villages.
  let room = SETTLEMENT_CAP - Object.values(picked).reduce((sum, list) => sum + list.length, 0);
  for (const name of ['town', 'village']) {
    if (room <= 0) break;
    const extra = spread(byBand[name], picked[name].length + room).slice(picked[name].length);
    picked[name].push(...extra);
    room -= extra.length;
  }
  for (const name of Object.keys(picked)) picked[name].sort((a, b) => a.localeCompare(b));
  return picked;
}

async function loadFiles(sourceDir) {
  const read = async (file) => {
    if (sourceDir) return readFile(path.join(sourceDir, file));
    console.log(`Fetching ${file}...`);
    const response = await fetch(`${DUMP_URL}${file}`);
    if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  };
  const zip = await JSZip.loadAsync(await read(FILES.cities));
  const entry = zip.file('cities500.txt');
  if (!entry) throw new Error(`${FILES.cities}: no cities500.txt inside`);
  return {
    cities: await entry.async('string'),
    admin1: (await read(FILES.admin1)).toString('utf8'),
    admin2: (await read(FILES.admin2)).toString('utf8'),
  };
}

function formatJson(data) {
  const lines = ['{', `  "source": ${JSON.stringify(data.source)},`, '  "origins": {'];
  const ids = Object.keys(data.origins);
  ids.forEach((id, index) => {
    const { settlements, regions } = data.origins[id];
    lines.push(`    ${JSON.stringify(id)}: {`);
    lines.push('      "settlements": {');
    lines.push(`        "village": ${JSON.stringify(settlements.village)},`);
    lines.push(`        "town": ${JSON.stringify(settlements.town)},`);
    lines.push(`        "city": ${JSON.stringify(settlements.city)}`);
    lines.push('      },');
    lines.push(`      "regions": ${JSON.stringify(regions)}`);
    lines.push(index < ids.length - 1 ? '    },' : '    }');
  });
  lines.push('  }', '}');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const sourceDir = process.argv[2] ? path.resolve(process.argv[2]) : null;
  const files = await loadFiles(sourceDir);

  const cities = splitTsv(files.cities)
    .filter((cols) => cols[6] === 'P' && SETTLEMENT_CODES.has(cols[7]))
    .map((cols) => ({
      name: cols[1],
      country: cols[8],
      admin1: cols[10],
      population: Number(cols[14]) || 0,
    }));
  const admins = [...splitTsv(files.admin1), ...splitTsv(files.admin2)].map((cols) => {
    const [country, admin1] = cols[0].split('.');
    return { name: cols[1], country, admin1 };
  });

  const origins = {};
  for (const origin of ORIGINS) {
    const spelling = (row) => (origin.plain ? plain(row.name) : row.name);
    const english = ENGLISH_ORIGINS.has(origin.id);
    const settlementStrip = english ? SETTLEMENT_STRIP : [...SETTLEMENT_STRIP, ...ENGLISH_GENERIC];
    const regionStrip = english ? REGION_STRIP : [...REGION_STRIP, ...ENGLISH_GENERIC];
    const settlementRows = cities
      .filter((row) => inArea(origin.areas, row.country, row.admin1))
      .map((row) => ({ name: cleanName(spelling(row), settlementStrip), population: row.population }))
      .filter((row) => row.name);
    const settlements = pickSettlements(settlementRows);
    const settlementSet = new Set(Object.values(settlements).flat());

    const regionNames = new Set();
    for (const row of admins) {
      if (!inArea(origin.areas, row.country, row.admin1)) continue;
      const name = cleanName(spelling(row), regionStrip);
      if (name && !settlementSet.has(name)) regionNames.add(name);
    }
    const regions = spread(regionNames, REGION_CAP).sort((a, b) => a.localeCompare(b));

    origins[origin.id] = { settlements, regions };
    const counts = ['village', 'town', 'city'].map((key) => `${key} ${String(settlements[key].length).padStart(3)}`).join('  ');
    console.log(`${origin.id.padEnd(14)} ${counts}  regions ${String(regions.length).padStart(3)}`);
  }

  const data = {
    source: {
      name: 'GeoNames',
      url: 'https://www.geonames.org/',
      files: Object.values(FILES),
      license: 'CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)',
      retrieved: new Date().toISOString().slice(0, 10),
    },
    origins,
  };

  await mkdir(path.dirname(outFile), { recursive: true });
  const json = formatJson(data);
  await writeFile(outFile, json, 'utf8');
  console.log(`Wrote ${path.relative(repoRoot, outFile)} (${(Buffer.byteLength(json) / 1024).toFixed(1)} KB)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
