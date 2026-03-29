import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => csvEscape(row[h])).join(','));
  }
  return lines.join('\n');
}

function main() {
  const projectRoot = process.cwd();
  const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/arc_experiment';
  const pool = new Pool({ connectionString: dbUrl });
  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const exportDir = path.join(projectRoot, 'exports', stamp);
  fs.mkdirSync(exportDir, { recursive: true });

  Promise.all([
    pool.query(`SELECT id, group_type, demographics, created_at FROM subjects ORDER BY created_at ASC`),
    pool.query(`SELECT id, user_id, task_id, phase, stage_label, stage_type, task_index_in_stage, group_type, metrics, final_grid_snapshot, created_at FROM sessions ORDER BY created_at ASC`),
    pool.query(`SELECT id, session_id, user_id, events, mouse_trace, created_at FROM telemetry_logs ORDER BY created_at ASC`)
  ]).then(([subjectsRes, sessionsRes, telemetryRes]) => {
    const subjects = subjectsRes.rows as any[];
    const sessionsRaw = sessionsRes.rows as any[];
    const telemetryRaw = telemetryRes.rows as any[];

    const sessionsFlat = sessionsRaw.map((row) => {
      const metrics: any = row.metrics || {};
      const finalGrid: any = row.final_grid_snapshot || null;

    const totalClicksNum = Number(metrics.total_clicks);
    const timeSpentNum = Number(metrics.time_spent_s);
    const relativeActionEfficiency =
      Number.isFinite(totalClicksNum) && totalClicksNum > 0 && Number.isFinite(timeSpentNum)
        ? timeSpentNum / totalClicksNum
        : null;

    return {
      session_id: row.id,
      user_id: row.user_id,
      group_type: row.group_type,
      phase: row.phase,
      stage_type: row.stage_type,
      stage_label: row.stage_label,
      task_index_in_stage: row.task_index_in_stage,
      task_id: row.task_id,
      is_correct: metrics.is_correct ?? null,
      skipped: metrics.skipped ?? null,
      forethought_time_ms: metrics.forethought_time_ms ?? null,
      time_spent_s: metrics.time_spent_s ?? null,
      total_clicks: metrics.total_clicks ?? null,
      confidence_level: metrics.confidence_level ?? null,
      ai_satisfaction: metrics.ai_satisfaction ?? null,
      relative_action_efficiency: relativeActionEfficiency,
      created_at: row.created_at,
      final_grid_snapshot_json: finalGrid ? JSON.stringify(finalGrid) : ''
    };
  });

    const telemetrySummary = telemetryRaw.map((row) => {
      const events: any[] = Array.isArray(row.events) ? row.events : [];
      const mouseTrace: any[] = Array.isArray(row.mouse_trace) ? row.mouse_trace : [];
      return {
      telemetry_id: row.id,
      session_id: row.session_id,
      user_id: row.user_id,
      event_count: Array.isArray(events) ? events.length : 0,
      mouse_trace_count: Array.isArray(mouseTrace) ? mouseTrace.length : 0,
      created_at: row.created_at
    };
  });

    fs.writeFileSync(path.join(exportDir, 'subjects.json'), JSON.stringify(subjects, null, 2), 'utf-8');
    fs.writeFileSync(path.join(exportDir, 'sessions_flat.json'), JSON.stringify(sessionsFlat, null, 2), 'utf-8');
    fs.writeFileSync(path.join(exportDir, 'telemetry_summary.json'), JSON.stringify(telemetrySummary, null, 2), 'utf-8');

    fs.writeFileSync(
      path.join(exportDir, 'subjects.csv'),
      toCsv(
        ['id', 'group_type', 'demographics', 'created_at'],
        subjects.map((s) => ({ ...s, demographics: JSON.stringify(s.demographics || {}) }))
      ),
      'utf-8'
    );

    fs.writeFileSync(
      path.join(exportDir, 'sessions_flat.csv'),
      toCsv(
        [
          'session_id', 'user_id', 'group_type', 'phase', 'stage_type', 'stage_label',
          'task_index_in_stage', 'task_id', 'is_correct', 'skipped', 'forethought_time_ms',
          'time_spent_s', 'total_clicks', 'confidence_level', 'ai_satisfaction',
          'relative_action_efficiency', 'created_at', 'final_grid_snapshot_json'
        ],
        sessionsFlat
      ),
      'utf-8'
    );

    fs.writeFileSync(
      path.join(exportDir, 'telemetry_summary.csv'),
      toCsv(['telemetry_id', 'session_id', 'user_id', 'event_count', 'mouse_trace_count', 'created_at'], telemetrySummary),
      'utf-8'
    );

    console.log('Export complete.');
    console.log(`Export directory: ${exportDir}`);
    console.log(`subjects: ${subjects.length}, sessions: ${sessionsFlat.length}, telemetry: ${telemetrySummary.length}`);
  }).finally(async () => {
    await pool.end();
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

main();
