// 运行时文件位置：可用 CYBER_XIAOWAN_PET_HOME 覆盖（测试/多实例），默认 ~/.cyber-xiaowan
import os from 'node:os';
import path from 'node:path';

export function runtimeHome() {
  return process.env.CYBER_XIAOWAN_PET_HOME || path.join(os.homedir(), '.cyber-xiaowan');
}

export function runtimeFile() {
  return path.join(runtimeHome(), 'pet.json');
}
