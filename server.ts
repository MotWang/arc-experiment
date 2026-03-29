import express from 'express';
import { createServer as createViteServer } from 'vite';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/arc_experiment';

const pool = new Pool({ connectionString: DATABASE_URL });
let latestStageDebugSnapshot: any = null;

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function readJsonFileSafe(filePath: string) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to read JSON file', filePath, err);
    return null;
  }
}

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      group_type TEXT,
      demographics JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      task_id TEXT,
      phase INTEGER,
      stage_label TEXT,
      stage_type TEXT,
      task_index_in_stage INTEGER,
      group_type TEXT,
      metrics JSONB,
      final_grid_snapshot JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS telemetry_logs (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      user_id TEXT,
      events JSONB,
      mouse_trace JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function parseMaybeJson(value: any) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return null;
}

async function startServer() {
  await initSchema();
  const app = express();

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.post('/api/subjects', async (req, res) => {
    const { group_type, demographics } = req.body;
    const id = crypto.randomUUID();
    await pool.query(
      'INSERT INTO subjects (id, group_type, demographics) VALUES ($1, $2, $3::jsonb)',
      [id, group_type, JSON.stringify(demographics || {})]
    );
    return res.json({ id });
  });

  app.post('/api/sessions', async (req, res) => {
    const {
      user_id,
      task_id,
      phase,
      stage_label = null,
      stage_type = null,
      task_index_in_stage = null,
      group_type = null,
      metrics,
      final_grid_snapshot
    } = req.body;
    const id = crypto.randomUUID();
    await pool.query(
      `
      INSERT INTO sessions (
        id, user_id, task_id, phase, stage_label, stage_type, task_index_in_stage, group_type, metrics, final_grid_snapshot
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
      `,
      [
        id,
        user_id,
        task_id,
        phase,
        stage_label,
        stage_type,
        task_index_in_stage,
        group_type,
        JSON.stringify(metrics || {}),
        JSON.stringify(final_grid_snapshot || null)
      ]
    );
    return res.json({ id });
  });

  app.post('/api/log', async (req, res) => {
    const { session_id, user_id, events, mouse_trace } = req.body;
    const id = crypto.randomUUID();
    await pool.query(
      'INSERT INTO telemetry_logs (id, session_id, user_id, events, mouse_trace) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)',
      [id, session_id, user_id, JSON.stringify(events || []), JSON.stringify(mouse_trace || [])]
    );
    return res.json({ status: 'ok' });
  });

  app.post('/api/ai-help', async (req, res) => {
    try {
      const { prompt } = req.body || {};
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Invalid prompt.' });
      }
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on server.' });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });

      return res.json({ text: response.text || '' });
    } catch (err: any) {
      console.error('AI help request failed:', err);
      return res.status(500).json({ error: err?.message || 'AI request failed.' });
    }
  });

  app.post('/api/stage-debug-cache', (req, res) => {
    latestStageDebugSnapshot = {
      generated_at: new Date().toISOString(),
      ...req.body
    };
    res.json({ status: 'ok' });
  });

  app.get('/api/stage-debug', (_req, res) => {
    if (!latestStageDebugSnapshot) {
      return res.status(404).json({
        message: 'No stage debug snapshot yet. Open the experiment page once to generate stages first.'
      });
    }
    res.json(latestStageDebugSnapshot);
  });

  // Unified ARC pool endpoint:
  // merge built-in public datasets + ARC-AGI training/evaluation datasets from workspace folders.
  app.get('/api/arc-pool', (_req, res) => {
    const sources = [
      {
        name: 'public_evaluation',
        challengesPath: path.join(__dirname, 'public', 'arc-agi_evaluation-challenges.json'),
        solutionsPath: path.join(__dirname, 'public', 'arc-agi_evaluation-solutions.json')
      },
      {
        name: 'public_default',
        challengesPath: path.join(__dirname, 'public', 'challenges.json'),
        solutionsPath: path.join(__dirname, 'public', 'solutions.json')
      },
      {
        name: 'arc_agi_1_training',
        challengesPath: path.join(WORKSPACE_ROOT, 'ARC-AGI 1 Data', 'arc-agi_training_challenges.json'),
        solutionsPath: path.join(WORKSPACE_ROOT, 'ARC-AGI 1 Data', 'arc-agi_training_solutions.json')
      },
      {
        name: 'arc_agi_1_evaluation',
        challengesPath: path.join(WORKSPACE_ROOT, 'ARC-AGI 1 Data', 'arc-agi_evaluation_challenges.json'),
        solutionsPath: path.join(WORKSPACE_ROOT, 'ARC-AGI 1 Data', 'arc-agi_evaluation_solutions.json')
      },
      {
        name: 'arc_agi_2_training',
        challengesPath: path.join(WORKSPACE_ROOT, 'ARC-AGI 2 Data', 'arc-prize-2026-arc-agi-2', 'arc-agi_training_challenges.json'),
        solutionsPath: path.join(WORKSPACE_ROOT, 'ARC-AGI 2 Data', 'arc-prize-2026-arc-agi-2', 'arc-agi_training_solutions.json')
      },
      {
        name: 'arc_agi_2_evaluation',
        challengesPath: path.join(WORKSPACE_ROOT, 'ARC-AGI 2 Data', 'arc-prize-2026-arc-agi-2', 'arc-agi_evaluation_challenges.json'),
        solutionsPath: path.join(WORKSPACE_ROOT, 'ARC-AGI 2 Data', 'arc-prize-2026-arc-agi-2', 'arc-agi_evaluation_solutions.json')
      }
    ];

    const mergedChallenges: Record<string, any> = {};
    const mergedSolutions: Record<string, any> = {};
    const loadedSources: string[] = [];
    const collisions: string[] = [];

    for (const source of sources) {
      const challenges = readJsonFileSafe(source.challengesPath) as Record<string, any> | null;
      const solutions = readJsonFileSafe(source.solutionsPath) as Record<string, any> | null;
      if (!challenges || !solutions) continue;

      loadedSources.push(source.name);
      for (const [taskId, task] of Object.entries(challenges)) {
        const namespacedId = `${source.name}__${taskId}`;
        if (mergedChallenges[namespacedId]) collisions.push(namespacedId);
        mergedChallenges[namespacedId] = task;
        if (solutions[taskId]) {
          mergedSolutions[namespacedId] = solutions[taskId];
        }
      }
    }

    res.json({
      sources: loadedSources,
      challenge_count: Object.keys(mergedChallenges).length,
      solution_count: Object.keys(mergedSolutions).length,
      collisions,
      challenges: mergedChallenges,
      solutions: mergedSolutions
    });
  });

  // Inspect collected experiment result rows
  app.get('/api/results', async (req, res) => {
    const userId = req.query.user_id as string | undefined;
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 300, 2000));
    const result = userId
      ? await pool.query(
          `SELECT id, user_id, task_id, phase, stage_label, stage_type, task_index_in_stage, group_type, metrics, final_grid_snapshot, created_at
           FROM sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
          [userId, limit]
        )
      : await pool.query(
          `SELECT id, user_id, task_id, phase, stage_label, stage_type, task_index_in_stage, group_type, metrics, final_grid_snapshot, created_at
           FROM sessions ORDER BY created_at DESC LIMIT $1`,
          [limit]
        );

    const parsed = result.rows.map((row: any) => ({
      ...row,
      metrics: parseMaybeJson(row.metrics),
      final_grid_snapshot: parseMaybeJson(row.final_grid_snapshot)
    }));
    return res.json({ total: parsed.length, rows: parsed });
  });

  // Inspect telemetry (mouse trace + event logs)
  app.get('/api/telemetry', async (req, res) => {
    const userId = req.query.user_id as string | undefined;
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 200, 1000));
    const result = userId
      ? await pool.query(
          `SELECT id, session_id, user_id, events, mouse_trace, created_at
           FROM telemetry_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
          [userId, limit]
        )
      : await pool.query(
          `SELECT id, session_id, user_id, events, mouse_trace, created_at
           FROM telemetry_logs ORDER BY created_at DESC LIMIT $1`,
          [limit]
        );

    const parsed = result.rows.map((row: any) => ({
      ...row,
      events: parseMaybeJson(row.events) || [],
      mouse_trace: parseMaybeJson(row.mouse_trace) || []
    }));
    return res.json({ total: parsed.length, rows: parsed });
  });

  // Export sessions as flat CSV (SPSS/R friendly)
  app.get('/api/export.csv', async (req, res) => {
    const userId = req.query.user_id as string | undefined;
    const groupType = req.query.group_type as string | undefined;
    const stageType = req.query.stage_type as string | undefined;

    const where: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (userId) {
      where.push(`user_id = $${paramIndex++}`);
      params.push(userId);
    }
    if (groupType) {
      where.push(`group_type = $${paramIndex++}`);
      params.push(groupType);
    }
    if (stageType) {
      where.push(`stage_type = $${paramIndex++}`);
      params.push(stageType);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const query = `
      SELECT
        id,
        user_id,
        task_id,
        phase,
        stage_label,
        stage_type,
        task_index_in_stage,
        group_type,
        metrics,
        final_grid_snapshot,
        created_at
      FROM sessions
      ${whereClause}
      ORDER BY created_at ASC
    `;

    const result = await pool.query(query, params);
    const rows = result.rows;
    const headers = [
      'session_id',
      'user_id',
      'group_type',
      'phase',
      'stage_type',
      'stage_label',
      'task_index_in_stage',
      'task_id',
      'is_correct',
      'skipped',
      'forethought_time_ms',
      'time_spent_s',
      'total_clicks',
      'confidence_level',
      'ai_satisfaction',
      'relative_action_efficiency',
      'created_at',
      'final_grid_snapshot_json'
    ];

    const lines = [headers.join(',')];
    for (const row of rows as any[]) {
      let metrics: any = {};
      try {
        metrics = parseMaybeJson(row.metrics) || {};
      } catch {
        metrics = {};
      }

      const totalClicksNum = Number(metrics.total_clicks);
      const timeSpentNum = Number(metrics.time_spent_s);
      const relativeActionEfficiency =
        Number.isFinite(totalClicksNum) && totalClicksNum > 0 && Number.isFinite(timeSpentNum)
          ? (timeSpentNum / totalClicksNum).toFixed(4)
          : '';

      const flatRow = [
        row.id,
        row.user_id,
        row.group_type,
        row.phase,
        row.stage_type,
        row.stage_label,
        row.task_index_in_stage,
        row.task_id,
        metrics.is_correct ?? '',
        metrics.skipped ?? '',
        metrics.forethought_time_ms ?? '',
        metrics.time_spent_s ?? '',
        metrics.total_clicks ?? '',
        metrics.confidence_level ?? '',
        metrics.ai_satisfaction ?? '',
        relativeActionEfficiency,
        row.created_at,
        row.final_grid_snapshot ? JSON.stringify(row.final_grid_snapshot) : ''
      ];

      lines.push(flatRow.map(csvEscape).join(','));
    }

    const csv = lines.join('\n');
    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="arc_sessions_export_${dateStr}.csv"`);
    return res.send(csv);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distDir, 'index.html'), (err) => {
        if (err) next(err);
      });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
