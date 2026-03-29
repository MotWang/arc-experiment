export type Language = 'en' | 'zh';

export const translations = {
  en: {
    title: "ARC Cognitive Experiment",
    selectGroup: "Select your experimental group to begin.",
    groupA: "Group A (Baseline)",
    groupB: "Group B (Frictionless AI)",
    groupC: "Group C (Socratic AI)",
    experimentComplete: "Experiment Complete",
    thankYou: "Thank you for participating.",
    phase: "Stage",
    task: "Task",
    group: "Group",
    difficulty: "Difficulty",
    timeElapsed: "Time Elapsed",
    trainingExamples: "Training Examples",
    input: "Input",
    output: "Output",
    testInput: "Test Input",
    yourOutput: "Your Output",
    aiAssistant: "AI Assistant",
    askForHelp: "Ask for Help",
    submitAnswer: "Submit Answer",
    skipTask: "Skip Task",
    reflectionTitle: "Task Reflection",
    confidenceLevel: "Confidence Level (1-10)",
    aiSatisfaction: "AI Satisfaction (1-10)",
    submitReflection: "Submit Reflection",
    langToggle: "中文",
    correctAnswer: "Correct Answer",
    aiPromptB: `You are a helpful AI assistant.
I will provide the logic rule for a visual puzzle.
Your task: Provide a very brief and simple text explanation of how to solve it.
Do NOT output the matrix itself, just the explanation.
MUST answer in English.`,
    aiPromptC: `You are a Socratic tutor for visual logic puzzles.
Use plain text only. Do not use markdown, bullets, symbols, or code blocks.
Do NOT output matrices/arrays or final answers.
Guide the user through a clear reasoning process in exactly 4 short lines:
Line 1 (Observation): What pattern should the user notice first?
Line 2 (Rule Guess): What rule might explain input->output changes?
Line 3 (Self-check): What quick check can verify the rule?
Line 4 (Action): What should the user draw first on the output grid?
Use easy wording, concrete verbs, and short sentences (<=16 words each).
Answer in English.`
  },
  zh: {
    title: "ARC 认知实验",
    selectGroup: "请选择您的实验组以开始。",
    groupA: "A组 (无AI组)",
    groupB: "B组 (无摩擦AI)",
    groupC: "C组 (苏格拉底式AI)",
    experimentComplete: "实验结束",
    thankYou: "感谢您的参与。",
    phase: "阶段",
    task: "任务",
    group: "组别",
    difficulty: "难度",
    timeElapsed: "已用时间",
    trainingExamples: "训练示例",
    input: "输入",
    output: "输出",
    testInput: "测试输入",
    yourOutput: "你的输出",
    aiAssistant: "AI 助手",
    askForHelp: "获取帮助",
    submitAnswer: "提交答案",
    skipTask: "跳过此题",
    reflectionTitle: "反馈",
    confidenceLevel: "自信程度 (1-10)",
    aiSatisfaction: "AI 满意度 (1-10)",
    submitReflection: "提交",
    langToggle: "English",
    correctAnswer: "正确答案",
    aiPromptB: `你是一个AI助手。
我将提供一个视觉谜题的逻辑规则。
你的任务：直接输出正确答案的图示（使用矩阵或数组形式），并且提供简单的文字解释即可。
必须用中文回答。`,
    aiPromptC: `你是苏格拉底式导师，帮助用户解视觉逻辑题。
只用纯文本输出，不要 markdown，不要 #、*、-、代码块。
绝对不要输出矩阵、数组或最终答案。
请严格输出 4 行短句，引导完整思考过程：
第1行（观察）：先观察到什么规律？
第2行（假设）：可能是什么变换规则？
第3行（验证）：用什么快速检查来验证规则？
第4行（行动）：用户在输出网格上第一步该画什么？
每行尽量不超过 24 个字，用词口语、清晰、易懂。`
  }
};
