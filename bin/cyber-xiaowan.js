#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const startPath = path.join(here, '..', 'START.md');
const text = await readFile(startPath, 'utf8');
process.stdout.write(text.trimEnd() + '\n');
