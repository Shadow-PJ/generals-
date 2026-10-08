// Measures how smoothly a battle runs at Steam Deck size (session 7H): opens the built game at
// 1280 × 800, starts a skirmish at double speed, and records every frame's time for a while.
// Prints frames per second, slow frames and how much of each frame the game's scripts take;
// with --cpu, also the functions that took the most time.
//
//   npm run build
//   npm run perf -- [--seconds 30] [--width 1280] [--height 800] [--cpu]
//
// The browser draws with software WebGL here, so the drawing numbers are worse than a real GPU's;
// the script time is the part the game's own code decides.

import { argValue, launchGame, press, waitForScene } from './launch';

const seconds = Number(argValue('seconds') ?? 30);
const width = Number(argValue('width') ?? 1280);
const height = Number(argValue('height') ?? 800);
const cpu = process.argv.includes('--cpu');

type FrameWindow = { __frames?: number[] };

interface CpuNode {
  id: number;
  callFrame: { functionName: string; url: string; lineNumber: number };
}
interface CpuProfile {
  nodes: CpuNode[];
  samples: number[];
  timeDeltas: number[];
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100))] ?? 0;
}

/** The functions the samples landed in most, by their own time. */
function hottest(profile: CpuProfile, count: number): string[] {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map<string, number>();
  profile.samples.forEach((id, i) => {
    const node = byId.get(id);
    if (!node) return;
    const { functionName, url, lineNumber } = node.callFrame;
    const name = `${functionName || '(anonymous)'} ${url.split('/').pop() ?? ''}:${lineNumber + 1}`;
    self.set(name, (self.get(name) ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000);
  });
  const total = [...self.values()].reduce((a, b) => a + b, 0);
  return [...self.entries()]
    .filter(([name]) => !name.startsWith('(idle)') && !name.startsWith('(program)'))
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([name, ms]) => `${ms.toFixed(0).padStart(6)} ms ${((ms / total) * 100).toFixed(1).padStart(5)}%  ${name}`);
}

async function main(): Promise<void> {
  const game = await launchGame({ width, height });
  const { page } = game;
  // To a skirmish: the title, the Capital, the skirmish screen, the orders, the battle.
  await press(page, 'Enter', 1500);
  await waitForScene(page, 'Capital');
  await press(page, 't', 1200);
  await waitForScene(page, 'Prep');
  await press(page, 'Enter', 1200);
  await waitForScene(page, 'Orders');
  await press(page, 'b', 1500);
  await waitForScene(page, 'Battle');
  await press(page, 'f', 200);
  const session = await page.context().newCDPSession(page);
  await session.send('Performance.enable');
  const metric = async (name: string) => {
    const { metrics } = (await session.send('Performance.getMetrics')) as { metrics: { name: string; value: number }[] };
    return metrics.find((m) => m.name === name)?.value ?? 0;
  };
  if (cpu) {
    await session.send('Profiler.enable');
    await session.send('Profiler.start');
  }
  const scriptBefore = await metric('ScriptDuration');
  // Every frame's time, from the page's own frame callback. Written as plain script text: the
  // page has none of the helpers tsx adds around named functions.
  await page.evaluate(`(() => {
    const frames = [];
    window.__frames = frames;
    let last = 0;
    const tick = (t) => {
      if (last > 0) frames.push(t - last);
      last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  })()`);
  // Cards and the ultimate as the battle goes, as a player would.
  const end = Date.now() + seconds * 1000;
  let slot = 0;
  while (Date.now() < end) {
    slot = (slot % 5) + 1;
    await press(page, String(slot), 700);
    await press(page, 'u', 300);
  }
  const frames = await page.evaluate(() => (globalThis as FrameWindow).__frames ?? []);
  const scriptMs = ((await metric('ScriptDuration')) - scriptBefore) * 1000;
  const heapMb = (await metric('JSHeapUsedSize')) / 1024 / 1024;
  const profile = cpu ? ((await session.send('Profiler.stop')) as { profile: CpuProfile }).profile : null;
  const errors = [...game.errors];
  await game.close();

  const sorted = [...frames].sort((a, b) => a - b);
  const total = frames.reduce((a, b) => a + b, 0);
  console.log(`Battle at ${width} × ${height}, double speed, ${seconds} s`);
  console.log(`Frames: ${frames.length}, ${(frames.length / (total / 1000)).toFixed(1)} per second`);
  console.log(`Frame time: median ${percentile(sorted, 50).toFixed(1)} ms, 95% ${percentile(sorted, 95).toFixed(1)} ms, 99% ${percentile(sorted, 99).toFixed(1)} ms, worst ${(sorted.at(-1) ?? 0).toFixed(1)} ms`);
  console.log(`Slow frames (over 33 ms): ${frames.filter((f) => f > 33.4).length}`);
  console.log(`Script time: ${(scriptMs / Math.max(1, frames.length)).toFixed(2)} ms a frame (${((scriptMs / total) * 100).toFixed(1)}% of the time)`);
  console.log(`Memory in use: ${heapMb.toFixed(1)} MB`);
  if (profile) {
    console.log('\nWhere the time went (own time):');
    for (const line of hottest(profile, 20)) console.log(line);
  }
  if (errors.length > 0) {
    console.log(`\nErrors: ${errors.length}`);
    for (const error of errors.slice(0, 10)) console.log('  ', error);
    process.exitCode = 1;
  }
}

await main();
