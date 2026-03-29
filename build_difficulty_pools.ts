import fs from 'fs';
import path from 'path';
import { customLowTasks } from './src/lib/custom_tasks';

type Difficulty = 'low' | 'medium' | 'high';

interface ArcTask {
  train: { input: number[][]; output: number[][] }[];
  test: { input: number[][] }[];
}

interface ArcSolutions {
  [taskId: string]: number[][][];
}

interface TaskData {
  id: string;
  difficulty: Difficulty;
  complexity_score: number;
  train: { input: number[][]; output: number[][] }[];
  test_input: number[][];
  ground_truth: number[][];
  explanation_en: string;
  explanation_zh: string;
}

const MAX_GRID_SIDE = 10;
const MAX_ALLOWED_COMPLEXITY = 1200;

function getGridMeta(grid: number[][]) {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  let nonZero = 0;
  const colors = new Set<number>();
  for (const row of grid) {
    for (const cell of row) {
      colors.add(cell);
      if (cell !== 0) nonZero += 1;
    }
  }
  return { rows, cols, nonZero, colors };
}

function estimateHumanComplexity(task: ArcTask, groundTruth: number[][]): number {
  const allGrids = [
    ...task.train.flatMap(ex => [ex.input, ex.output]),
    ...task.test.map(ex => ex.input),
    groundTruth
  ];
  let maxArea = 0;
  let maxNonZero = 0;
  const colors = new Set<number>();
  for (const grid of allGrids) {
    const meta = getGridMeta(grid);
    maxArea = Math.max(maxArea, meta.rows * meta.cols);
    maxNonZero = Math.max(maxNonZero, meta.nonZero);
    meta.colors.forEach(c => colors.add(c));
  }
  const nonBackgroundColorCount = [...colors].filter(c => c !== 0).length;
  return maxArea + (nonBackgroundColorCount * 16) + (maxNonZero * 2);
}

function isTaskUsable(task: ArcTask, groundTruth: number[][]): boolean {
  const allGrids = [
    ...task.train.flatMap(ex => [ex.input, ex.output]),
    ...task.test.map(ex => ex.input),
    groundTruth
  ];
  if (task.train.length < 2 || task.train.length > 4) return false;
  for (const grid of allGrids) {
    if (!Array.isArray(grid) || grid.length === 0 || !Array.isArray(grid[0])) return false;
    const rows = grid.length;
    const cols = grid[0].length;
    if (rows <= 0 || cols <= 0 || rows > MAX_GRID_SIDE || cols > MAX_GRID_SIDE) return false;
  }
  return true;
}

function readJsonSafe<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function sourceFiles(root: string) {
  return [
    {
      source: 'arc_agi_1_training',
      c: path.join(root, 'ARC-AGI 1 Data', 'arc-agi_training_challenges.json'),
      s: path.join(root, 'ARC-AGI 1 Data', 'arc-agi_training_solutions.json')
    },
    {
      source: 'arc_agi_1_evaluation',
      c: path.join(root, 'ARC-AGI 1 Data', 'arc-agi_evaluation_challenges.json'),
      s: path.join(root, 'ARC-AGI 1 Data', 'arc-agi_evaluation_solutions.json')
    },
    {
      source: 'arc_agi_2_training',
      c: path.join(root, 'ARC-AGI 2 Data', 'arc-prize-2026-arc-agi-2', 'arc-agi_training_challenges.json'),
      s: path.join(root, 'ARC-AGI 2 Data', 'arc-prize-2026-arc-agi-2', 'arc-agi_training_solutions.json')
    },
    {
      source: 'arc_agi_2_evaluation',
      c: path.join(root, 'ARC-AGI 2 Data', 'arc-prize-2026-arc-agi-2', 'arc-agi_evaluation_challenges.json'),
      s: path.join(root, 'ARC-AGI 2 Data', 'arc-prize-2026-arc-agi-2', 'arc-agi_evaluation_solutions.json')
    }
  ];
}

function main() {
  const projectRoot = process.cwd();
  const workspaceRoot = path.resolve(projectRoot, '..');
  const publicDir = path.join(projectRoot, 'public');

  const scored: Array<{ task: TaskData; complexity: number }> = [];

  for (const src of sourceFiles(workspaceRoot)) {
    const challenges = readJsonSafe<Record<string, ArcTask>>(src.c);
    const solutions = readJsonSafe<ArcSolutions>(src.s);
    if (!challenges || !solutions) continue;

    for (const [taskId, task] of Object.entries(challenges)) {
      const gt = solutions[taskId]?.[0];
      if (!gt) continue;
      if (!isTaskUsable(task, gt)) continue;
      const complexity = estimateHumanComplexity(task, gt);
      if (complexity > MAX_ALLOWED_COMPLEXITY) continue;

      scored.push({
        complexity,
        task: {
          id: `${src.source}__${taskId}`,
          difficulty: 'low',
          complexity_score: complexity,
          train: task.train,
          test_input: task.test[0].input,
          ground_truth: gt,
          explanation_en: 'Please observe the input and output patterns to find the logic.',
          explanation_zh: '请观察输入和输出的模式以找出逻辑规律。'
        }
      });
    }
  }

  scored.sort((a, b) => a.complexity - b.complexity);
  if (scored.length < 24) {
    throw new Error(`Not enough usable ARC tasks (${scored.length}) after filtering.`);
  }

  const lowCut = Math.max(24, Math.floor(scored.length * 0.45));
  const medCut = Math.max(lowCut + 24, Math.floor(scored.length * 0.8));

  const low = scored.slice(0, lowCut).map(x => ({ ...x.task, difficulty: 'low' as const }));
  const medium = scored.slice(lowCut, medCut).map(x => ({ ...x.task, difficulty: 'medium' as const }));
  const high = scored.slice(medCut).map(x => ({ ...x.task, difficulty: 'high' as const }));

  const lowWithFallback = [...customLowTasks.map(t => ({ ...t, complexity_score: t.complexity_score ?? 20 })), ...low];

  fs.writeFileSync(path.join(publicDir, 'arc_pool_low.json'), JSON.stringify(lowWithFallback, null, 2), 'utf-8');
  fs.writeFileSync(path.join(publicDir, 'arc_pool_medium.json'), JSON.stringify(medium, null, 2), 'utf-8');
  fs.writeFileSync(path.join(publicDir, 'arc_pool_high.json'), JSON.stringify(high, null, 2), 'utf-8');

  console.log('Built difficulty pools:', {
    low: lowWithFallback.length,
    medium: medium.length,
    high: high.length
  });
}

main();
