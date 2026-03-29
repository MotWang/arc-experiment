import React, { useState, useEffect } from 'react';
import { ARCGrid } from './ARCGrid';
import { useTelemetry } from '../hooks/useTelemetry';
import { Loader2, Send } from 'lucide-react';
import { Language, translations } from '../lib/i18n';

interface TaskViewProps {
  task: any;
  group: 'A' | 'B' | 'C';
  userId: string;
  phase: number;
  lang: Language;
  aiEnabled: boolean;
  onComplete: (metrics: any, finalGrid: number[][]) => void;
}

export const TaskView: React.FC<TaskViewProps> = ({ task, group, userId, phase, lang, aiEnabled, onComplete }) => {
  const t = translations[lang];
  const [sessionId] = useState(() => crypto.randomUUID());
  const { logAction, flushData, startTime } = useTelemetry(sessionId, userId);
  
  const [currentGrid, setCurrentGrid] = useState<number[][]>(() => 
    task.test_input.map((row: number[]) => [...row])
  );
  
  const [selectedColor, setSelectedColor] = useState(1);
  const [clickCount, setClickCount] = useState(0);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiPredictedGrid, setAiPredictedGrid] = useState<number[][] | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiThinkingStep, setAiThinkingStep] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [hasFirstClick, setHasFirstClick] = useState(false);
  const [forethoughtTime, setForethoughtTime] = useState(0);
  
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [showReflection, setShowReflection] = useState(false);
  const [isSkipped, setIsSkipped] = useState(false);
  const [confidence, setConfidence] = useState<number>(5);
  const [aiSatisfaction, setAiSatisfaction] = useState<number>(5);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const extractJsonObject = (text: string): unknown => {
    const trimmed = text.trim();
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/m);
    if (fence) {
      try {
        return JSON.parse(fence[1].trim());
      } catch {
        /* fall through */
      }
    }
    const start = trimmed.indexOf('{');
    if (start === -1) return null;
    let depth = 0;
    for (let i = start; i < trimmed.length; i++) {
      const c = trimmed[i];
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(trimmed.slice(start, i + 1));
          } catch {
            return null;
          }
        }
      }
    }
    return null;
  };

  const isValidGrid = (grid: unknown): grid is number[][] => {
    if (!Array.isArray(grid) || grid.length === 0) return false;
    const firstRow = grid[0];
    if (!Array.isArray(firstRow) || firstRow.length === 0) return false;
    const w = firstRow.length;
    for (const row of grid) {
      if (!Array.isArray(row) || row.length !== w) return false;
      for (const cell of row) {
        if (typeof cell !== 'number' || !Number.isInteger(cell) || cell < 0 || cell > 9) return false;
      }
    }
    return true;
  };

  const compactExplanation = (text: string): string => {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    if (lang === 'zh') {
      return normalized.length > 28 ? `${normalized.slice(0, 28)}...` : normalized;
    }
    return normalized.length > 90 ? `${normalized.slice(0, 90)}...` : normalized;
  };

  const sanitizeSocraticText = (text: string): string => {
    const cleaned = text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/^[\s>*#`-]+/gm, '')
      .replace(/[*#`]/g, '')
      .replace(/\r/g, '\n')
      .replace(/\n{2,}/g, '\n')
      .trim();

    if (!cleaned) return '';

    const lines = cleaned
      .split('\n')
      .map(line => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    if (lang === 'zh') {
      const normalized = (lines.length > 0 ? lines : cleaned.split(/[；;。]/))
        .map(s => s.trim())
        .filter(Boolean)
        .slice(0, 4)
        .map(s => (s.length > 30 ? `${s.slice(0, 30)}...` : s));
      return normalized.join('\n');
    }

    const normalized = (lines.length > 0 ? lines : cleaned.split(/[.;]/))
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 4)
      .map(s => (s.length > 110 ? `${s.slice(0, 110)}...` : s));
    return normalized.join('\n');
  };

  const handleCellClick = (r: number, c: number) => {
    if (!hasFirstClick) {
      setHasFirstClick(true);
      setForethoughtTime(Date.now() - startTime.current);
    }
    
    setClickCount(prev => prev + 1);
    logAction('pixel_paint', { r, c, new_color: selectedColor });
    
    const newGrid = currentGrid.map(row => [...row]);
    newGrid[r][c] = selectedColor;
    setCurrentGrid(newGrid);
  };

  const addRow = () => {
    const cols = currentGrid[0]?.length ?? 1;
    if (currentGrid.length >= 10) return;
    setCurrentGrid(prev => [...prev, Array(cols).fill(0)]);
    logAction('grid_resize', { action: 'add_row' });
  };

  const removeRow = () => {
    if (currentGrid.length <= 1) return;
    setCurrentGrid(prev => prev.slice(0, -1));
    logAction('grid_resize', { action: 'remove_row' });
  };

  const addCol = () => {
    const cols = currentGrid[0]?.length ?? 1;
    if (cols >= 10) return;
    setCurrentGrid(prev => prev.map(row => [...row, 0]));
    logAction('grid_resize', { action: 'add_col' });
  };

  const removeCol = () => {
    const cols = currentGrid[0]?.length ?? 1;
    if (cols <= 1) return;
    setCurrentGrid(prev => prev.map(row => row.slice(0, -1)));
    logAction('grid_resize', { action: 'remove_col' });
  };

  const resetGridSizeToTestInput = () => {
    const targetRows = task.test_input.length;
    const targetCols = task.test_input[0]?.length ?? 1;
    if (targetRows < 1 || targetCols < 1) return;
    setCurrentGrid(prev => {
      const result = Array.from({ length: targetRows }, (_, r) =>
        Array.from({ length: targetCols }, (_, c) => prev[r]?.[c] ?? 0)
      );
      return result;
    });
    logAction('grid_resize', { action: 'reset_to_test_input_size', rows: targetRows, cols: targetCols });
  };

  const handleAskAi = async () => {
    logAction('ai_ask', { group });
    setIsAiLoading(true);
    setAiError(null);
    setAiResponse(null);
    setAiPredictedGrid(null);

    const thinkingSteps = lang === 'zh'
      ? ['正在读取训练示例...', '正在归纳变换规则...', '正在检查测试输入...', '正在组织提示答案...']
      : ['Reading training examples...', 'Inferring transformation rule...', 'Checking test input...', 'Composing helpful hint...'];
    setAiThinkingStep(thinkingSteps[0]);

    let stepIndex = 0;
    const timer = setInterval(() => {
      stepIndex = (stepIndex + 1) % thinkingSteps.length;
      setAiThinkingStep(thinkingSteps[stepIndex]);
    }, 1200);

    try {
      if (group === 'A') {
        return;
      }

      let prompt = '';
      const explanation = lang === 'en' ? task.explanation_en : task.explanation_zh;
      const trainDataStr = JSON.stringify(task.train);
      const testInputStr = JSON.stringify(task.test_input);

      if (group === 'B') {
        const jsonShape = '{"grid": [[...]], "explanation": "..."}';
        if (lang === 'zh') {
          prompt = `根据以下训练示例、测试输入与逻辑规则，预测测试输入对应的输出网格。\n\n训练示例：${trainDataStr}\n测试输入：${testInputStr}\n逻辑规则：${explanation}\n\n请只输出一个 JSON 对象，不要夹杂其他文字。格式严格为：${jsonShape}。grid 为二维数组，元素为 0-9 的整数；explanation 必须极简（最多 20 个汉字）。`;
        } else {
          prompt = `Given the training examples, test input, and logic rule below, predict the output grid for the test input.\n\nTraining Examples: ${trainDataStr}\nTest Input: ${testInputStr}\nLogic Rule: ${explanation}\n\nRespond with ONLY a single JSON object, no other text. Use this exact shape: ${jsonShape}. The grid is a 2D array of integers 0-9; explanation must be ultra-brief (<=12 words, one sentence).`;
        }
      } else if (group === 'C') {
        prompt = `${t.aiPromptC}\n\nTraining Examples: ${trainDataStr}\nLogic Rule: ${explanation}`;
      }

      const response = await fetch('/api/ai-help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'AI service unavailable');
      }

      const responseText = payload?.text || '';

      if (group === 'B') {
        const parsed = extractJsonObject(responseText);
        let nextGrid: number[][] | null = null;
        let nextExplanation: string | null = null;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const p = parsed as Record<string, unknown>;
          if (isValidGrid(p.grid)) nextGrid = p.grid;
          if (typeof p.explanation === 'string' && p.explanation.trim()) {
            nextExplanation = compactExplanation(p.explanation);
          }
        }
        if (nextGrid === null && nextExplanation === null) {
          setAiPredictedGrid(null);
          setAiResponse(responseText);
        } else {
          setAiPredictedGrid(nextGrid);
          setAiResponse(nextExplanation);
        }
        logAction('ai_response_received', { response: responseText, parsed_grid: nextGrid !== null });
      } else {
        setAiResponse(group === 'C' ? sanitizeSocraticText(responseText) : responseText);
        logAction('ai_response_received', { response: responseText });
      }
    } catch (err) {
      console.error(err);
      setAiError(lang === 'zh' ? 'AI 暂时不可用，请稍后重试。' : 'AI is temporarily unavailable. Please try again.');
    } finally {
      clearInterval(timer);
      setAiThinkingStep(null);
      setIsAiLoading(false);
    }
  };

  const handleSubmit = async () => {
    logAction('submit_intent', { final_grid: currentGrid });
    setIsTimerRunning(false);
    setIsSkipped(false);
    setShowReflection(true);
  };

  const handleSkip = async () => {
    logAction('skip_intent', { current_grid: currentGrid });
    setIsTimerRunning(false);
    setIsSkipped(true);
    setShowReflection(true);
  };

  const handleReflectionSubmit = async () => {
    logAction('reflection_submit', { confidence, aiSatisfaction, isSkipped });
    await flushData();
    
    const isCorrect = isSkipped ? false : JSON.stringify(currentGrid) === JSON.stringify(task.ground_truth);
    
    onComplete({
      is_correct: isCorrect,
      forethought_time_ms: forethoughtTime,
      total_clicks: clickCount,
      time_spent_s: timeElapsed,
      skipped: isSkipped,
      confidence_level: confidence,
      ai_satisfaction: (group !== 'A' && aiEnabled) ? aiSatisfaction : null
    }, currentGrid);
  };

  if (showReflection) {
    return (
      <div className="flex flex-col h-full max-w-2xl mx-auto p-6 bg-gray-50 justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">{t.reflectionTitle}</h2>
          
          <div className="mb-8 text-left">
            <label className="block text-gray-700 font-medium mb-2">{t.confidenceLevel}</label>
            <div className="flex justify-between items-center gap-4">
              <span className="text-sm text-gray-500">1 (Low)</span>
              <input 
                type="range" min="1" max="10" step="1" 
                value={confidence} 
                onChange={(e) => setConfidence(parseInt(e.target.value))}
                className="w-full accent-blue-600"
              />
              <span className="text-sm text-gray-500">10 (High)</span>
            </div>
            <div className="text-center mt-2 font-bold text-blue-600 text-xl">{confidence}</div>
          </div>

          {group !== 'A' && aiEnabled && (
            <div className="mb-8 text-left">
              <label className="block text-gray-700 font-medium mb-2">{t.aiSatisfaction}</label>
              <div className="flex justify-between items-center gap-4">
                <span className="text-sm text-gray-500">1 (Low)</span>
                <input 
                  type="range" min="1" max="10" step="1" 
                  value={aiSatisfaction} 
                  onChange={(e) => setAiSatisfaction(parseInt(e.target.value))}
                  className="w-full accent-purple-600"
                />
                <span className="text-sm text-gray-500">10 (High)</span>
              </div>
              <div className="text-center mt-2 font-bold text-purple-600 text-xl">{aiSatisfaction}</div>
            </div>
          )}

          <button 
            onClick={handleReflectionSubmit}
            className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 shadow-md transition-colors"
          >
            {t.submitReflection}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto p-6 bg-gray-50 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-800">{t.task}: {task.id}</h2>
          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
            {t.difficulty}: {task.difficulty}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-lg font-mono font-bold text-blue-600 bg-blue-50 px-4 py-1 rounded-lg border border-blue-200">
            {t.timeElapsed}: {formatTime(timeElapsed)}
          </div>
          <div className="text-sm text-gray-500 font-mono">{t.phase} {phase} | {t.group} {group}</div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Top: Training examples */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">{t.trainingExamples}</h3>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {task.train.map((pair: any, idx: number) => (
              <div key={idx} className="flex items-center justify-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100 overflow-auto">
                <div className="flex flex-col items-center min-w-fit">
                  <span className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-semibold">{t.input}</span>
                  <ARCGrid gridData={pair.input} telemetryIdPrefix={`train_${idx}_input`} logAction={logAction} />
                </div>
                <Send className="w-4 h-4 text-gray-300 flex-shrink-0" />
                <div className="flex flex-col items-center min-w-fit">
                  <span className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-semibold">{t.output}</span>
                  <ARCGrid gridData={pair.output} telemetryIdPrefix={`train_${idx}_output`} logAction={logAction} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: Test and answer area */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">{t.testInput}</h3>
          
          <div className="mb-6 flex flex-wrap items-center justify-center gap-6 overflow-auto">
            <div className="flex flex-col items-center min-w-fit">
              <span className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-semibold">{t.input}</span>
              <ARCGrid gridData={task.test_input} telemetryIdPrefix="test_input" logAction={logAction} />
            </div>
            <Send className="w-6 h-6 text-gray-300 flex-shrink-0" />
            <div className="flex flex-col items-center min-w-fit">
              <span className="text-xs text-blue-500 mb-2 uppercase tracking-wider font-semibold">{t.yourOutput}</span>
              <ARCGrid 
                gridData={currentGrid} 
                isInteractive={true} 
                onCellClick={handleCellClick}
                telemetryIdPrefix="test_output" 
                logAction={logAction} 
              />
            </div>
          </div>

          {/* Color Palette */}
          <div className="mb-6 flex gap-2 justify-center">
            {[0,1,2,3,4,5,6,7,8,9].map(c => (
              <button
                key={c}
                className={`w-10 h-10 border-2 rounded-md transition-transform ${selectedColor === c ? 'scale-110 border-blue-500 shadow-md' : 'border-gray-300'}`}
                style={{ backgroundColor: ['#000000', '#0074D9', '#FF4136', '#2ECC40', '#FFDC00', '#AAAAAA', '#F012BE', '#FF851B', '#7FDBFF', '#870C25'][c] }}
                onClick={() => {
                  setSelectedColor(c);
                  logAction('color_pick', { color: c });
                }}
                data-telemetry-id={`color_picker_${c}`}
              />
            ))}
          </div>

          {/* Grid resize controls for tasks with shape transform */}
          <div className="mb-6 flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="text-gray-500 mr-1">{lang === 'zh' ? '输出尺寸' : 'Output Size'}:</span>
            <span className="px-2 py-1 bg-gray-100 rounded border text-gray-700 font-mono">
              {currentGrid.length} x {currentGrid[0]?.length ?? 0}
            </span>
            <button
              onClick={removeRow}
              className="px-3 py-1 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              data-telemetry-id="btn_resize_remove_row"
            >
              {lang === 'zh' ? '行 -' : 'Row -'}
            </button>
            <button
              onClick={addRow}
              className="px-3 py-1 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              data-telemetry-id="btn_resize_add_row"
            >
              {lang === 'zh' ? '行 +' : 'Row +'}
            </button>
            <button
              onClick={removeCol}
              className="px-3 py-1 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              data-telemetry-id="btn_resize_remove_col"
            >
              {lang === 'zh' ? '列 -' : 'Col -'}
            </button>
            <button
              onClick={addCol}
              className="px-3 py-1 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              data-telemetry-id="btn_resize_add_col"
            >
              {lang === 'zh' ? '列 +' : 'Col +'}
            </button>
            <button
              onClick={resetGridSizeToTestInput}
              className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-md hover:bg-blue-100"
              data-telemetry-id="btn_resize_reset_to_test_input"
            >
              {lang === 'zh' ? '重置为测试输入尺寸' : 'Reset to Test Input Size'}
            </button>
          </div>

          {/* AI Assistant Area */}
          {aiEnabled && (group === 'B' || group === 'C') && (
            <div className="bg-blue-50 rounded-xl p-4 mb-6 border border-blue-100">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-blue-800">{t.aiAssistant}</h4>
                {!(aiResponse !== null || aiPredictedGrid !== null) && (
                  <button 
                    onClick={handleAskAi}
                    disabled={isAiLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    data-telemetry-id="btn_ask_ai"
                  >
                    {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {t.askForHelp}
                  </button>
                )}
              </div>
              {(aiResponse !== null || aiPredictedGrid !== null) && (
                <div className="flex flex-col gap-4">
                  {group === 'B' && (
                    <div className="flex flex-col items-center bg-white p-4 rounded border border-blue-100">
                      <span className="text-xs text-blue-600 mb-2 uppercase tracking-wider font-semibold">
                        {lang === 'zh' ? 'AI 输出网格' : 'AI Output Grid'}
                      </span>
                      {aiPredictedGrid ? (
                        <ARCGrid gridData={aiPredictedGrid} telemetryIdPrefix="ai_predicted_grid" logAction={logAction} />
                      ) : (
                        <p className="text-xs text-gray-500 text-center max-w-sm">
                          {lang === 'zh' ? '未能解析 AI 返回的网格 JSON。' : 'Could not parse a valid grid from the AI response.'}
                        </p>
                      )}
                    </div>
                  )}
                  {aiResponse !== null && aiResponse !== '' && (
                    <div 
                      className="text-sm text-gray-700 whitespace-pre-wrap bg-white p-3 rounded border border-blue-100"
                      data-telemetry-id="ai_response_box"
                    >
                      {aiResponse}
                    </div>
                  )}
                </div>
              )}
              {isAiLoading && (
                <div className="flex items-start gap-2 text-sm text-blue-700 whitespace-pre-wrap bg-white p-3 rounded border border-blue-100">
                  <Loader2 className="w-4 h-4 animate-spin mt-0.5" />
                  <span>{aiThinkingStep || (lang === 'zh' ? 'AI 正在思考中...' : 'AI is thinking...')}</span>
                </div>
              )}
              {aiError && !isAiLoading && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-100">
                  {aiError}
                </div>
              )}
              <p className="mt-2 text-xs text-gray-500">
                {lang === 'zh'
                  ? 'AI 助手基于主流 LLM 生成，答案并不代表绝对正确。'
                  : 'AI assistant outputs are generated by mainstream LLMs and are not guaranteed to be absolutely correct.'}
              </p>
            </div>
          )}

          <div className="mt-4 flex justify-end gap-4">
            <button 
              onClick={handleSkip}
              className="px-8 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 shadow-sm transition-colors"
              data-telemetry-id="btn_skip"
            >
              {t.skipTask}
            </button>
            <button 
              onClick={handleSubmit}
              className="px-8 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 shadow-md transition-colors"
              data-telemetry-id="btn_submit"
            >
              {t.submitAnswer}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
