import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const outFile = path.join(repoRoot, 'src', 'agent', 'hosts', 'names', 'fakerNames.json');

const FAKER_REPO = 'https://github.com/faker-js/faker.git';
// Unreleased commit on next: the first one with en_GB surnames (after v10.6.0).
const FAKER_COMMIT = '12c73677f549910e0ac752f15a93d41cc3cc1fe0';

// Latin-script locales only: the model writes cards in English, and Faker ships no romanization.
// Skipped on purpose: joke locales (en_BORK, en_AU_ocker), Esperanto, de_AT (same lists as de),
// fr_BE (surnames are en + fr mixed), and locales missing first or last names. en_GB has no first names, so it borrows en's.
const ORIGINS = [
  { id: 'afrikaans', label: 'Afrikaans', locale: 'af_ZA' },
  { id: 'american', label: 'American', locale: 'en' },
  { id: 'australian', label: 'Australian', locale: 'en_AU' },
  { id: 'azerbaijani', label: 'Azerbaijani', locale: 'az' },
  { id: 'brazilian', label: 'Brazilian', locale: 'pt_BR' },
  { id: 'british', label: 'British', locale: 'en_GB', firstFrom: 'en' },
  { id: 'croatian', label: 'Croatian', locale: 'hr' },
  { id: 'czech', label: 'Czech', locale: 'cs_CZ' },
  { id: 'danish', label: 'Danish', locale: 'da' },
  { id: 'dutch', label: 'Dutch', locale: 'nl' },
  { id: 'finnish', label: 'Finnish', locale: 'fi' },
  { id: 'flemish', label: 'Flemish', locale: 'nl_BE' },
  { id: 'french', label: 'French', locale: 'fr' },
  { id: 'german', label: 'German', locale: 'de' },
  { id: 'ghanaian', label: 'Ghanaian', locale: 'en_GH' },
  { id: 'hungarian', label: 'Hungarian', locale: 'hu' },
  { id: 'indian', label: 'Indian', locale: 'en_IN' },
  { id: 'indonesian', label: 'Indonesian', locale: 'id_ID' },
  { id: 'italian', label: 'Italian', locale: 'it' },
  { id: 'kurdish', label: 'Kurdish (Kurmanji)', locale: 'ku_kmr_latin' },
  { id: 'latvian', label: 'Latvian', locale: 'lv' },
  { id: 'mexican', label: 'Mexican', locale: 'es_MX' },
  { id: 'moldovan', label: 'Moldovan', locale: 'ro_MD' },
  { id: 'nepali', label: 'Nepali', locale: 'en_NP' },
  { id: 'nigerian', label: 'Nigerian', locale: 'en_NG' },
  { id: 'norwegian', label: 'Norwegian', locale: 'nb_NO' },
  { id: 'polish', label: 'Polish', locale: 'pl', feminineSurname: (name) => name.replace(/ki$/, 'ka').replace(/y$/, 'a') },
  { id: 'portuguese', label: 'Portuguese', locale: 'pt_PT' },
  { id: 'romanian', label: 'Romanian', locale: 'ro' },
  { id: 'senegalese', label: 'Senegalese', locale: 'fr_SN' },
  { id: 'serbian', label: 'Serbian', locale: 'sr_RS_latin' },
  { id: 'slovak', label: 'Slovak', locale: 'sk' },
  { id: 'slovene', label: 'Slovene', locale: 'sl_SI' },
  { id: 'south-african', label: 'South African', locale: 'en_ZA' },
  { id: 'spanish', label: 'Spanish', locale: 'es' },
  { id: 'swedish', label: 'Swedish', locale: 'sv' },
  { id: 'swiss-french', label: 'Swiss French', locale: 'fr_CH' },
  { id: 'swiss-german', label: 'Swiss German', locale: 'de_CH' },
  { id: 'turkish', label: 'Turkish', locale: 'tr' },
  { id: 'uzbek', label: 'Uzbek', locale: 'uz_UZ_latin' },
  { id: 'vietnamese', label: 'Vietnamese', locale: 'vi' },
  { id: 'yoruba', label: 'Yoruba', locale: 'yo_NG' },
  { id: 'zulu', label: 'Zulu', locale: 'zu_ZA' },
];

const NAME_PATTERN = /^\p{Script=Latin}[\p{Script=Latin}\p{M}]*(?:[ '’‘ʻ.-]\p{Script=Latin}[\p{Script=Latin}\p{M}]*)*$/u;
const MAX_NAME_LENGTH = 30;

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: repoRoot, stdio: 'inherit', shell: false });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`));
    });
    child.on('error', reject);
  });
}

async function cloneFaker(dir) {
  await run('git', ['init', '--quiet', dir]);
  await run('git', ['-C', dir, 'sparse-checkout', 'set', 'src/locales']);
  await run('git', ['-C', dir, 'fetch', '--quiet', '--depth', '1', '--filter=blob:none', FAKER_REPO, FAKER_COMMIT]);
  await run('git', ['-C', dir, '-c', 'advice.detachedHead=false', 'checkout', '--quiet', 'FETCH_HEAD']);
}

function stringArray(node, file) {
  if (!ts.isArrayLiteralExpression(node)) throw new Error(`${file}: expected an array literal`);
  return node.elements.map((element) => {
    if (!ts.isStringLiteral(element)) throw new Error(`${file}: expected only string literals`);
    return element.text;
  });
}

// Parses the data file without executing it. Faker writes either `export default [...]`
// or `export default { generic?, female?, male? }`.
async function readNameFile(fakerDir, locale, kind) {
  const file = path.join(fakerDir, 'src', 'locales', locale, 'person', `${kind}.ts`);
  if (!existsSync(file)) return null;
  const source = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, false);
  const exported = source.statements.find(ts.isExportAssignment);
  if (!exported) throw new Error(`${file}: no export default`);
  const value = exported.expression;
  if (ts.isArrayLiteralExpression(value)) return { generic: stringArray(value, file) };
  if (!ts.isObjectLiteralExpression(value)) throw new Error(`${file}: unexpected export shape`);
  const lists = {};
  for (const property of value.properties) {
    if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) {
      throw new Error(`${file}: unexpected property`);
    }
    const key = property.name.text;
    if (key !== 'generic' && key !== 'female' && key !== 'male') throw new Error(`${file}: unexpected key ${key}`);
    lists[key] = stringArray(property.initializer, file);
  }
  return lists;
}

function cleanList(names, stats) {
  const seen = new Set();
  const kept = [];
  for (const raw of names) {
    const name = raw.normalize('NFC').trim();
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (name.length > MAX_NAME_LENGTH || !NAME_PATTERN.test(name)) {
      stats.dropped.push(name);
      continue;
    }
    kept.push(name);
  }
  return kept.sort();
}

// Faker's `generic` list is usually female + male plus a few unisex names, so it is only
// kept as `any` when the locale has no gendered split.
function toGenderedLists(lists, stats) {
  if (!lists) return null;
  const out = {};
  if (lists.female?.length || lists.male?.length) {
    if (lists.female?.length) out.female = cleanList(lists.female, stats);
    if (lists.male?.length) out.male = cleanList(lists.male, stats);
  } else if (lists.generic?.length) {
    out.any = cleanList(lists.generic, stats);
  }
  return Object.keys(out).length > 0 ? out : null;
}

function countNames(lists) {
  return Object.values(lists).reduce((sum, list) => sum + list.length, 0);
}

function formatJson(data) {
  const lines = ['{'];
  lines.push(`  "source": ${JSON.stringify(data.source)},`);
  lines.push('  "origins": {');
  const ids = Object.keys(data.origins);
  ids.forEach((id, index) => {
    const origin = data.origins[id];
    lines.push(`    ${JSON.stringify(id)}: {`);
    lines.push(`      "label": ${JSON.stringify(origin.label)},`);
    for (const part of ['first', 'last']) {
      lines.push(`      "${part}": {`);
      const keys = Object.keys(origin[part]);
      keys.forEach((key, keyIndex) => {
        const comma = keyIndex < keys.length - 1 ? ',' : '';
        lines.push(`        ${JSON.stringify(key)}: ${JSON.stringify(origin[part][key])}${comma}`);
      });
      lines.push(part === 'first' ? '      },' : '      }');
    }
    lines.push(index < ids.length - 1 ? '    },' : '    }');
  });
  lines.push('  }');
  lines.push('}');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const argPath = process.argv[2];
  let fakerDir = argPath ? path.resolve(argPath) : null;
  let tempDir = null;

  try {
    if (!fakerDir) {
      tempDir = await mkdtemp(path.join(tmpdir(), 'faker-names-'));
      fakerDir = path.join(tempDir, 'faker');
      console.log(`Fetching faker ${FAKER_COMMIT.slice(0, 7)}...`);
      await cloneFaker(fakerDir);
    }

    const fakerPackage = JSON.parse(await readFile(path.join(fakerDir, 'package.json'), 'utf8'));
    const license = (await readFile(path.join(fakerDir, 'LICENSE'), 'utf8')).replace(/\r\n/g, '\n').trim();

    const origins = {};
    for (const origin of ORIGINS) {
      const stats = { dropped: [] };
      const first = toGenderedLists(await readNameFile(fakerDir, origin.firstFrom ?? origin.locale, 'first_name'), stats);
      let last = toGenderedLists(await readNameFile(fakerDir, origin.locale, 'last_name'), stats);
      if (!first || !last) throw new Error(`${origin.locale}: missing first or last names`);
      // Faker keeps only the masculine form; adjectival surnames take a feminine ending (Kowalski/Kowalska).
      if (origin.feminineSurname && last.any) {
        last = { female: [...new Set(last.any.map(origin.feminineSurname))].sort(), male: last.any };
      }
      origins[origin.id] = { label: origin.label, first, last };
      const dropped = stats.dropped.length > 0 ? `  dropped ${stats.dropped.length}: ${stats.dropped.slice(0, 5).join(', ')}` : '';
      console.log(`${origin.id.padEnd(14)} first ${String(countNames(first)).padStart(5)}  last ${String(countNames(last)).padStart(5)}${dropped}`);
    }

    const data = {
      source: {
        name: '@faker-js/faker',
        version: fakerPackage.version,
        commit: argPath ? undefined : FAKER_COMMIT,
        url: 'https://github.com/faker-js/faker',
        license,
      },
      origins,
    };

    await mkdir(path.dirname(outFile), { recursive: true });
    await writeFile(outFile, formatJson(data), 'utf8');
    console.log(`Wrote ${path.relative(repoRoot, outFile)}`);
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
