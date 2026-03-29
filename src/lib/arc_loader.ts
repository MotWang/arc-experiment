import { TaskData } from './arc_data';
import { customLowTasks } from './custom_tasks';

interface ArcTask {
  train: { input: number[][], output: number[][] }[];
  test: { input: number[][] }[];
}

interface ArcSolutions {
  [taskId: string]: number[][][];
}

const MAX_GRID_SIDE = 10;
const MAX_VISIBLE_COMPLEXITY = 360;
const STAGE_COUNT = 2;
const TASKS_PER_DIFFICULTY_PER_STAGE = 4;
const MIN_UNIQUE_PER_DIFFICULTY = 4;
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

function isGridWithinViewport(grid: number[][]): boolean {
  const { rows, cols } = getGridMeta(grid);
  return rows > 0 && cols > 0 && rows <= MAX_GRID_SIDE && cols <= MAX_GRID_SIDE;
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

  // Heuristic tuned for human-solvable medium/high tasks:
  // keep object count and color variety under control while preserving challenge.
  const nonBackgroundColorCount = [...colors].filter(c => c !== 0).length;
  return maxArea + (nonBackgroundColorCount * 16) + (maxNonZero * 2);
}

function isHumanSolvableViewportTask(task: ArcTask, groundTruth: number[][], maxComplexity: number): boolean {
  const allGrids = [
    ...task.train.flatMap(ex => [ex.input, ex.output]),
    ...task.test.map(ex => ex.input),
    groundTruth
  ];

  if (!allGrids.every(isGridWithinViewport)) return false;
  if (task.train.length < 2 || task.train.length > 4) return false;

  return estimateHumanComplexity(task, groundTruth) <= maxComplexity;
}

function calculateDifficulty(task: ArcTask): 'low' | 'medium' | 'high' {
  let maxGridSize = 0;
  let uniqueColors = new Set<number>();

  task.train.forEach(ex => {
    maxGridSize = Math.max(maxGridSize, ex.input.length * ex.input[0].length);
    maxGridSize = Math.max(maxGridSize, ex.output.length * ex.output[0].length);
    
    ex.input.forEach(row => row.forEach(c => uniqueColors.add(c)));
    ex.output.forEach(row => row.forEach(c => uniqueColors.add(c)));
  });

  const score = maxGridSize + (uniqueColors.size * 10);

  if (score <= 356) return 'low';
  if (score <= 579) return 'medium';
  return 'high';
}

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

function createCycler<T>(pool: T[]) {
  let buffer = shuffleArray(pool);
  let idx = 0;

  return (count: number): T[] => {
    const result: T[] = [];
    if (pool.length === 0) return result;

    for (let i = 0; i < count; i++) {
      if (idx >= buffer.length) {
        buffer = shuffleArray(pool);
        idx = 0;
      }
      result.push(buffer[idx]);
      idx += 1;
    }

    return result;
  };
}

async function fetchArcFiles() {
  try {
    const poolRes = await fetch('/api/arc-pool');
    if (poolRes.ok) {
      const pool = await poolRes.json();
      if (pool?.challenges && pool?.solutions) {
        return {
          challenges: pool.challenges as Record<string, ArcTask>,
          solutions: pool.solutions as ArcSolutions
        };
      }
    }
  } catch (err) {
    console.warn('Failed to load /api/arc-pool, fallback to static files', err);
  }

  const challengeCandidates = ['/arc-agi_evaluation-challenges.json', '/challenges.json'];
  const solutionCandidates = ['/arc-agi_evaluation-solutions.json', '/solutions.json'];

  let challengesRes: Response | null = null;
  let solutionsRes: Response | null = null;

  for (const path of challengeCandidates) {
    const res = await fetch(path);
    if (res.ok) {
      challengesRes = res;
      break;
    }
  }

  for (const path of solutionCandidates) {
    const res = await fetch(path);
    if (res.ok) {
      solutionsRes = res;
      break;
    }
  }

  if (!challengesRes || !solutionsRes) {
    throw new Error('Failed to load ARC evaluation files. Expected arc-agi_evaluation-*.json or challenges/solutions.json in public/.');
  }

  return {
    challenges: await challengesRes.json() as Record<string, ArcTask>,
    solutions: await solutionsRes.json() as ArcSolutions
  };
}

async function fetchCuratedDifficultyPools(): Promise<{ low: TaskData[]; medium: TaskData[]; high: TaskData[] } | null> {
  try {
    const [lowRes, mediumRes, highRes] = await Promise.all([
      fetch('/arc_pool_low.json'),
      fetch('/arc_pool_medium.json'),
      fetch('/arc_pool_high.json')
    ]);

    if (!lowRes.ok || !mediumRes.ok || !highRes.ok) return null;
    const [low, medium, high] = await Promise.all([
      lowRes.json() as Promise<TaskData[]>,
      mediumRes.json() as Promise<TaskData[]>,
      highRes.json() as Promise<TaskData[]>
    ]);
    if (low.length === 0 || medium.length === 0 || high.length === 0) return null;
    return { low, medium, high };
  } catch {
    return null;
  }
}

export async function loadAndClassifyArcTasks(): Promise<{ stages: TaskData[][] }> {
  try {
    const curatedPools = await fetchCuratedDifficultyPools();
    if (curatedPools) {
      const nextLowBatch = createCycler(curatedPools.low);
      const nextMediumBatch = createCycler(curatedPools.medium);
      const nextHighBatch = createCycler(curatedPools.high);
      const stages: TaskData[][] = [];
      for (let stageIdx = 0; stageIdx < STAGE_COUNT; stageIdx++) {
        const lowBatch = nextLowBatch(TASKS_PER_DIFFICULTY_PER_STAGE).map(t => ({ ...t, difficulty: 'low' as const }));
        const mediumBatch = nextMediumBatch(TASKS_PER_DIFFICULTY_PER_STAGE).map(t => ({ ...t, difficulty: 'medium' as const }));
        const highBatch = nextHighBatch(TASKS_PER_DIFFICULTY_PER_STAGE).map(t => ({ ...t, difficulty: 'high' as const }));
        // Keep fixed difficulty order in each stage: low -> medium -> high
        stages.push([...lowBatch, ...mediumBatch, ...highBatch]);
      }
      return { stages };
    }

    const { challenges, solutions } = await fetchArcFiles();

    type ScoredTask = { task: TaskData; complexity: number };
    const scoredTasks: ScoredTask[] = [];

    for (const [taskId, task] of Object.entries(challenges)) {
      if (!solutions[taskId]) continue;

      const groundTruth = solutions[taskId][0];
      if (!groundTruth) continue;
      if (!isHumanSolvableViewportTask(task, groundTruth, 2000)) continue;
      
      const taskData: TaskData = {
        id: taskId,
        difficulty: 'low',
        complexity_score: 0,
        train: task.train,
        test_input: task.test[0].input,
        ground_truth: groundTruth,
        explanation_en: "Please observe the input and output patterns to find the logic.",
        explanation_zh: "请观察输入和输出的模式以找出逻辑规律。"
      };
      const complexity = estimateHumanComplexity(task, groundTruth);
      if (complexity <= MAX_ALLOWED_COMPLEXITY) {
        scoredTasks.push({ task: { ...taskData, complexity_score: complexity }, complexity });
      }
    }
    if (scoredTasks.length === 0) {
      throw new Error('No ARC tasks remained after 10x10 viewport filtering.');
    }

    const filtered = scoredTasks
      .sort((a, b) => a.complexity - b.complexity);

    const lowCut = Math.max(MIN_UNIQUE_PER_DIFFICULTY, Math.floor(filtered.length * 0.45));
    const mediumCut = Math.max(lowCut + MIN_UNIQUE_PER_DIFFICULTY, Math.floor(filtered.length * 0.8));

    const lowFromDataset = filtered.slice(0, lowCut).map(x => ({ ...x.task, difficulty: 'low' as const }));
    const mediumCurated = filtered
      .slice(lowCut, mediumCut)
      .map(x => ({ ...x.task, difficulty: 'medium' as const }));
    const highCurated = filtered
      .slice(mediumCut)
      .map(x => ({ ...x.task, difficulty: 'high' as const }));

    const lowPool = [...customLowTasks, ...lowFromDataset];

    if (lowPool.length === 0 || mediumCurated.length === 0 || highCurated.length === 0) {
      throw new Error('Insufficient ARC pools for low/medium/high after adaptive filtering.');
    }

    const nextLowBatch = createCycler(lowPool);
    const nextMediumBatch = createCycler(mediumCurated);
    const nextHighBatch = createCycler(highCurated);
    const stages: TaskData[][] = [];
    for (let stageIdx = 0; stageIdx < STAGE_COUNT; stageIdx++) {
      const lowBatch = nextLowBatch(TASKS_PER_DIFFICULTY_PER_STAGE);
      const mediumBatch = nextMediumBatch(TASKS_PER_DIFFICULTY_PER_STAGE);
      const highBatch = nextHighBatch(TASKS_PER_DIFFICULTY_PER_STAGE);
      // Keep fixed difficulty order in each stage: low -> medium -> high
      stages.push([...lowBatch, ...mediumBatch, ...highBatch]);
    }

    console.info('ARC stage pools prepared', {
      selectedMaxComplexity: MAX_ALLOWED_COMPLEXITY,
      totalCandidates: filtered.length,
      lowCount: lowPool.length,
      mediumCount: mediumCurated.length,
      highCount: highCurated.length,
      stageCount: stages.length
    });

    return { stages };
  } catch (error) {
    console.error('Error loading ARC tasks:', error);
    // Return fallback empty arrays if files are missing
    return { stages: [] };
  }
}
