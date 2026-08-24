#!/usr/bin/env node
// DSH 桥：观察本机 DSH 会话活动，自动切换桌宠状态。
//
//   node pet/integrations/dsh-watch.mjs          # 前台运行（Ctrl-C 退出）
//   nohup node pet/integrations/dsh-watch.mjs &  # 后台常驻
//
// 规则：
//   - 最近 20 秒内有会话写入  → work（干活中）
//   - 安静超过 2 分钟        → idle（待机）
//   - 安静超过 8 分钟        → sleep（打盹）
//   - 桌宠未运行时只等待，不报错。
import { readdir, stat, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runtimeFile } from '../runtime-paths.mjs';

const sessionsRoot = process.env.DSH_SESSIONS_ROOT || path.join(os.homedir(), '.dsh', 'sessions');
const POLL_MS = 5000;
const WORK_WINDOW_MS = 20_000;
const IDLE_AFTER_MS = 2 * 60_000;
const SLEEP_AFTER_MS = 8 * 60_000;

let lastState = null;

async function latestMtime(dir, depth) {
  let newest = 0;
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (depth <= 0) continue;
      newest = Math.max(newest, await latestMtime(full, depth - 1));
    } else if (/\.(zstd|jsonl|ndjson)$/.test(entry.name)) {
      const info = await stat(full).catch(() => null);
      if (info && info.mtimeMs > newest) newest = info.mtimeMs;
    }
  }
  return newest;
}

async function postState(stateName) {
  try {
    const info = JSON.parse(await readFile(runtimeFile(), 'utf8'));
    if (!info.port) return;
    await fetch(`http://127.0.0.1:${info.port}/api/state`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state: stateName }),
      signal: AbortSignal.timeout(1500),
    });
    lastState = stateName;
  } catch {
    // 桌宠未运行：保持等待
  }
}

async function tick() {
  const newest = existsSync(sessionsRoot) ? await latestMtime(sessionsRoot, 3) : 0;
  const quietFor = newest ? Date.now() - newest : Infinity;

  let target;
  if (quietFor < WORK_WINDOW_MS) target = 'work';
  else if (quietFor > SLEEP_AFTER_MS || newest === 0) target = 'sleep';
  else if (quietFor > IDLE_AFTER_MS) target = 'idle';
  else target = lastState; // 刚安静下来，维持原状

  if (target && target !== lastState) await postState(target);
}

console.log(`[dsh-watch] 观察 ${sessionsRoot}，每 ${POLL_MS / 1000}s 轮询一次。`);
setInterval(() => tick().catch(() => {}), POLL_MS);
tick().catch(() => {});
