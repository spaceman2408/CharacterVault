import { mkdtemp, rm, cp, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const distDir = path.join(repoRoot, 'dist');

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: false,
      ...options,
    });

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

async function hasStagedChanges(worktreeDir) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['-C', worktreeDir, 'diff', '--cached', '--quiet'], {
      cwd: repoRoot,
      stdio: 'ignore',
      shell: false,
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve(false);
        return;
      }
      if (code === 1) {
        resolve(true);
        return;
      }
      reject(new Error(`git diff --cached --quiet failed with exit code ${code}`));
    });

    child.on('error', reject);
  });
}

async function ensureGhPagesWorktree(worktreeDir) {
  try {
    await run('git', ['fetch', 'origin', 'gh-pages']);
    await run('git', ['worktree', 'add', '--track', '-B', 'gh-pages', worktreeDir, 'origin/gh-pages']);
  } catch {
    await run('git', ['worktree', 'add', '--orphan', worktreeDir]);
  }

  await run('git', ['-C', worktreeDir, 'config', 'core.autocrlf', 'false']);
  await run('git', ['-C', worktreeDir, 'config', 'core.eol', 'lf']);
}

async function clearWorktree(worktreeDir) {
  const entries = await readdir(worktreeDir, { withFileTypes: true });

  await Promise.all(
    entries
      .filter((entry) => entry.name !== '.git')
      .map((entry) =>
        rm(path.join(worktreeDir, entry.name), {
          recursive: true,
          force: true,
        })
      )
  );
}

async function copyDistContents(sourceDir, targetDir) {
  const entries = await readdir(sourceDir, { withFileTypes: true });

  await Promise.all(
    entries.map((entry) =>
      cp(path.join(sourceDir, entry.name), path.join(targetDir, entry.name), {
        recursive: true,
        force: true,
      })
    )
  );
}

async function main() {
  const worktreeDir = await mkdtemp(path.join(tmpdir(), 'charactervault-pages-'));

  try {
    await ensureGhPagesWorktree(worktreeDir);
    await clearWorktree(worktreeDir);
    await copyDistContents(distDir, worktreeDir);

    await writeFile(path.join(worktreeDir, '.nojekyll'), '');

    await run('git', ['-C', worktreeDir, 'add', '-A']);
    if (await hasStagedChanges(worktreeDir)) {
      await run('git', ['-C', worktreeDir, 'commit', '-m', 'Deploy GitHub Pages']);
    }
    await run('git', ['-C', worktreeDir, 'push', 'origin', 'gh-pages']);
  } finally {
    try {
      await run('git', ['worktree', 'remove', worktreeDir, '--force']);
    } catch {
      await rm(worktreeDir, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
