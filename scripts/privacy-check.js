#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const packageRoots = ['README.md', 'SKILL.md', 'START.md', 'agents', 'bin', 'package.json', 'pet', 'references', 'scripts'];

const forbiddenContent = [
  { label: '本机绝对路径', pattern: /(?:\/Users\/|\/home\/[^/\s]+\/|[A-Za-z]:\\Users\\)/ },
  { label: '飞书共享链接', pattern: /https:\/\/[^\s)]+\.feishu\.cn\/share\//i },
  { label: '私钥块', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { label: '常见密钥或令牌', pattern: /(?:github_pat_|ghp_|xox[baprs]-|AKIA)[A-Za-z0-9_-]{12,}/ },
  { label: '微信内部 ID', pattern: /wxid_[A-Za-z0-9_-]{6,}/i },
];

const forbiddenName = /(?:^|[._-])(?:\.env|credentials?|secrets?|private|tokens?)(?:[._-]|$)/i;

async function collect(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  const entries = await readdir(absolutePath, { withFileTypes: true }).catch(() => null);
  if (!entries) return [relativePath];

  const files = [];
  for (const entry of entries) {
    const child = path.join(relativePath, entry.name);
    if (entry.isDirectory()) files.push(...await collect(child));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}

const files = (await Promise.all(packageRoots.map(collect))).flat();
const errors = [];

for (const relativePath of files) {
  if (forbiddenName.test(relativePath)) errors.push(`${relativePath}: 可疑文件名`);

  const text = await readFile(path.join(repoRoot, relativePath), 'utf8').catch(() => null);
  if (text === null) continue;
  for (const check of forbiddenContent) {
    if (check.pattern.test(text)) errors.push(`${relativePath}: ${check.label}`);
  }
}

if (errors.length) {
  process.stderr.write(`隐私检查失败：\n- ${errors.join('\n- ')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`隐私检查通过：已检查 ${files.length} 个发布文件。\n`);
}
