#!/usr/bin/env node
// Codex CLI 桥：把 agent 生命周期事件映射成桌宠状态。
//
// 在 ~/.codex/config.toml 里加一行（路径换成你本仓库的绝对路径）：
//   notify = ["node", "<repo>/pet/integrations/codex-notify.mjs"]
//
// 桌宠没在运行时静默退出，绝不阻塞 Codex。
import { readFile } from 'node:fs/promises';
import { runtimeFile } from '../runtime-paths.mjs';

function pickState(event) {
  const type = String((event && event.type) || '');
  if (type.includes('turn-complete') || type.includes('task-complete')) return 'clap';
  if (type.includes('error') || type.includes('fail')) return 'question';
  if (type.includes('start') || type.includes('begin')) return 'work';
  return null;
}

async function main() {
  const raw = process.argv[2];
  if (!raw) return;
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return;
  }
  const state = pickState(event);
  if (!state) return;

  try {
    const info = JSON.parse(await readFile(runtimeFile, 'utf8'));
    if (!info.port) return;
    await fetch(`http://127.0.0.1:${info.port}/api/state`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state }),
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    // 桌宠未运行或网络异常：直接忽略
  }
}

main();
