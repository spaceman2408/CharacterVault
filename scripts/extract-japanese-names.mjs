import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const outFile = path.join(repoRoot, 'src', 'agent', 'hosts', 'names', 'japaneseNames.json');

const REPO = 'shuheilocale/japanese-personal-name-dataset';
const COMMIT = '467ceaa3e7c92f68b5e62b1b176d62641569fe43';
const DATASET_DIR = 'japanese_personal_name_dataset/dataset';

// The curated "opti" lists keep common readings; the full lists are mostly rare ones.
const SOURCES = {
  female: { file: 'first_name_woman_opti.csv', kanaColumn: 0 },
  male: { file: 'first_name_man_opti.csv', kanaColumn: 0 },
  last: { file: 'last_name_org.csv', kanaColumn: 2 },
};

const KANA = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', ゐ: 'i', ゑ: 'e', を: 'o', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ゔ: 'vu',
};
const SMALL_Y = { ゃ: 'a', ゅ: 'u', ょ: 'o' };
const SMALL_VOWEL = { ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o' };

function toHiragana(text) {
  return text.replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

// Hepburn as names are usually written in English: no long-vowel marks (Satō → Sato, Yūko → Yuko),
// n stays n before b/m/p, and no apostrophe after n.
function kanaToRomaji(kana) {
  const syllables = [];
  let doubleNext = false;
  for (const char of toHiragana(kana.normalize('NFC'))) {
    if (char === 'っ') {
      doubleNext = true;
      continue;
    }
    if (char === 'ー') continue;
    let romaji;
    if (SMALL_Y[char]) {
      const base = syllables.pop();
      if (!base?.endsWith('i')) return null;
      romaji = /(sh|ch|j)i$/.test(base) ? base.slice(0, -1) + SMALL_Y[char] : `${base.slice(0, -1)}y${SMALL_Y[char]}`;
    } else if (SMALL_VOWEL[char]) {
      const base = syllables.pop();
      if (!base) return null;
      romaji = base === 'u' ? `w${SMALL_VOWEL[char]}` : base.replace(/[aeiou]$/, '') + SMALL_VOWEL[char];
    } else {
      romaji = KANA[char];
      if (!romaji) return null;
      if (doubleNext && /^[^aeioun]/.test(romaji)) romaji = romaji.startsWith('ch') ? `t${romaji}` : romaji[0] + romaji;
      doubleNext = false;
    }
    syllables.push(romaji);
  }
  const joined = syllables.join('').replace(/ou/g, 'o').replace(/oo/g, 'o').replace(/uu/g, 'u');
  if (!joined) return null;
  return joined[0].toUpperCase() + joined.slice(1);
}

async function fetchText(filePath) {
  const url = `https://raw.githubusercontent.com/${REPO}/${COMMIT}/${filePath}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.text();
}

async function readNames({ file, kanaColumn }) {
  const text = await fetchText(`${DATASET_DIR}/${file}`);
  const names = new Set();
  const dropped = [];
  for (const line of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const kana = line.split(',')[kanaColumn]?.trim();
    if (!kana) continue;
    const romaji = kanaToRomaji(kana);
    if (romaji) names.add(romaji);
    else dropped.push(kana);
  }
  return { names: [...names].sort(), dropped };
}

function formatJson(data) {
  const pretty = JSON.stringify(data, null, 2);
  return `${pretty.replace(/\[\n\s+("[^\]]*?")\n\s+\]/g, (_, items) => `[${items.replace(/,\n\s+/g, ',')}]`)}\n`;
}

async function main() {
  const lists = {};
  for (const [key, source] of Object.entries(SOURCES)) {
    const { names, dropped } = await readNames(source);
    lists[key] = names;
    const droppedNote = dropped.length > 0 ? `  dropped ${dropped.length}: ${dropped.slice(0, 5).join(', ')}` : '';
    console.log(`${key.padEnd(7)} ${String(names.length).padStart(5)}${droppedNote}`);
  }
  const license = (await fetchText('LICENSE')).replace(/\r\n/g, '\n').trim();

  const data = {
    source: {
      name: 'japanese-personal-name-dataset',
      commit: COMMIT,
      url: `https://github.com/${REPO}`,
      license,
      note: 'Romanized from the hiragana readings by scripts/extract-japanese-names.mjs.',
    },
    origins: {
      japanese: {
        label: 'Japanese',
        first: { female: lists.female, male: lists.male },
        last: { any: lists.last },
      },
    },
  };

  await mkdir(path.dirname(outFile), { recursive: true });
  await writeFile(outFile, formatJson(data), 'utf8');
  console.log(`Wrote ${path.relative(repoRoot, outFile)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
