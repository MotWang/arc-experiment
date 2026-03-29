import React, { useState, useEffect } from 'react';
import { TaskView } from './components/TaskView';
import { TaskData } from './lib/arc_data';
import { loadAndClassifyArcTasks } from './lib/arc_loader';
import { Language, translations } from './lib/i18n';

export default function App() {
  const TOTAL_STAGES = 2;
  const LEARNING_STAGE_COUNT = 1;

  const [lang, setLang] = useState<Language>('zh');
  const t = translations[lang];

  const [userId, setUserId] = useState<string | null>(null);
  const [group, setGroup] = useState<'A' | 'B' | 'C' | null>(null);
  const [phase, setPhase] = useState<number>(0);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [stages, setStages] = useState<TaskData[][]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [taskLoadError, setTaskLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTasks() {
      try {
        const { stages } = await loadAndClassifyArcTasks();
        if (stages.length !== TOTAL_STAGES || stages.some(s => s.length < 12)) {
          setTaskLoadError('Failed to prepare 2 stages (each stage needs 12 tasks = 4 low + 4 medium + 4 high).');
        } else {
          setStages(stages);
          const debugStages = stages.map((stage, stageIndex) => ({
            stage_index: stageIndex + 1,
            tasks: stage.map(task => ({
              task_id: task.id,
              difficulty: task.difficulty,
              complexity: task.complexity_score ?? null
            }))
          }));
          fetch('/api/stage-debug-cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              total_stages: stages.length,
              tasks_per_stage: stages[0]?.length || 0,
              stages: debugStages
            })
          }).catch(() => {
            // Debug endpoint is best-effort only.
          });
        }
      } catch (err: any) {
        setTaskLoadError(`Error loading tasks: ${err.message}`);
      } finally {
        setIsLoadingTasks(false);
      }
    }
    fetchTasks();
  }, []);

  const toggleLang = () => setLang(prev => prev === 'en' ? 'zh' : 'en');

  const handleRegister = async (selectedGroup: 'A' | 'B' | 'C') => {
    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_type: selectedGroup,
          demographics: { age: 25, education: 'bachelors' }
        })
      });
      const data = await res.json();
      setUserId(data.id);
      setGroup(selectedGroup);
      setPhase(1);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTaskComplete = async (metrics: any, finalGrid: number[][]) => {
    const currentTasks = stages[phase - 1] || [];
    const stageType = phase <= LEARNING_STAGE_COUNT ? 'learning' : 'atrophy';
    const stageLabel = `${stageType}_stage_${phase}`;
    const enrichedMetrics = {
      ...metrics,
      stage_index: phase,
      stage_type: stageType,
      stage_label: stageLabel,
      task_index_in_stage: currentTaskIndex + 1,
      group_type: group
    };

    try {
      await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          task_id: currentTasks[currentTaskIndex].id,
          phase,
          stage_type: stageType,
          stage_label: stageLabel,
          task_index_in_stage: currentTaskIndex + 1,
          group_type: group,
          metrics: enrichedMetrics,
          final_grid_snapshot: finalGrid
        })
      });

      if (currentTaskIndex < currentTasks.length - 1) {
        setCurrentTaskIndex(prev => prev + 1);
      } else {
        if (phase < TOTAL_STAGES) {
          setPhase(prev => prev + 1);
          setCurrentTaskIndex(0);
        } else {
          setIsFinished(true);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoadingTasks) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl font-medium text-gray-600">Loading ARC tasks...</div>
      </div>
    );
  }

  if (taskLoadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-red-50 text-red-700 p-6 rounded-xl max-w-lg text-center border border-red-200">
          <h2 className="text-xl font-bold mb-2">Configuration Required</h2>
          <p>{taskLoadError}</p>
        </div>
      </div>
    );
  }

  if (!userId || !group) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 relative">
        <button 
          onClick={toggleLang}
          className="absolute top-6 right-6 px-4 py-2 bg-white border rounded-lg shadow-sm hover:bg-gray-50 font-medium text-gray-700"
        >
          {t.langToggle}
        </button>
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">{t.title}</h1>
          <p className="text-gray-600 mb-8">{t.selectGroup}</p>
          <div className="space-y-4">
            <button onClick={() => handleRegister('A')} className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium text-gray-800 transition-colors">{t.groupA}</button>
            <button onClick={() => handleRegister('B')} className="w-full py-3 px-4 bg-blue-100 hover:bg-blue-200 rounded-xl font-medium text-blue-800 transition-colors">{t.groupB}</button>
            <button onClick={() => handleRegister('C')} className="w-full py-3 px-4 bg-purple-100 hover:bg-purple-200 rounded-xl font-medium text-purple-800 transition-colors">{t.groupC}</button>
          </div>
        </div>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 relative">
        <button 
          onClick={toggleLang}
          className="absolute top-6 right-6 px-4 py-2 bg-white border rounded-lg shadow-sm hover:bg-gray-50 font-medium text-gray-700"
        >
          {t.langToggle}
        </button>
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{t.experimentComplete}</h1>
          <p className="text-gray-600">{t.thankYou}</p>
        </div>
      </div>
    );
  }

  const currentTasks = stages[phase - 1] || [];
  const currentTask = currentTasks[currentTaskIndex];

  if (!currentTask) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-red-50 text-red-700 p-6 rounded-xl max-w-lg text-center border border-red-200">
          <h2 className="text-xl font-bold mb-2">Task Allocation Error</h2>
          <p>No task available for the current stage. Please verify task data files.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-100 overflow-hidden flex flex-col">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm z-10">
        <h1 className="text-xl font-bold text-gray-800">{t.title}</h1>
        <div className="flex items-center gap-4 text-sm font-medium text-gray-600">
          <span className="bg-gray-100 px-3 py-1 rounded-full">{t.phase}: {phase}</span>
          <span className="bg-gray-100 px-3 py-1 rounded-full">{t.task}: {currentTaskIndex + 1} / {currentTasks.length}</span>
          <span className="bg-gray-100 px-3 py-1 rounded-full">{t.group}: {group}</span>
          <button 
            onClick={toggleLang}
            className="ml-2 px-3 py-1 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            {t.langToggle}
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <TaskView 
          key={`${phase}-${currentTask.id}`}
          task={currentTask} 
          group={group} 
          userId={userId} 
          phase={phase} 
          lang={lang}
          aiEnabled={phase <= LEARNING_STAGE_COUNT}
          onComplete={handleTaskComplete} 
        />
      </main>
    </div>
  );
}
