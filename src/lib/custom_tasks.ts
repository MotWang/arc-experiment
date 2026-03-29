import { TaskData } from './arc_data';

export const customLowTasks: TaskData[] = [
  {
    id: "custom_3x3_fill",
    difficulty: "low",
    train: [
      {
        input: [[0,0,0],[0,1,0],[0,0,0]],
        output: [[1,1,1],[1,1,1],[1,1,1]]
      },
      {
        input: [[2,0,0],[0,0,0],[0,0,0]],
        output: [[2,2,2],[2,2,2],[2,2,2]]
      }
    ],
    test_input: [[0,0,0],[0,0,0],[0,0,3]],
    ground_truth: [[3,3,3],[3,3,3],[3,3,3]],
    explanation_en: "Fill the entire 3x3 grid with the color of the single non-zero pixel.",
    explanation_zh: "用网格中唯一非零像素的颜色填充整个 3x3 网格。"
  },
  {
    id: "custom_3x3_cross",
    difficulty: "low",
    train: [
      {
        input: [[0,0,0],[0,4,0],[0,0,0]],
        output: [[0,4,0],[4,4,4],[0,4,0]]
      },
      {
        input: [[0,0,0],[0,2,0],[0,0,0]],
        output: [[0,2,0],[2,2,2],[0,2,0]]
      }
    ],
    test_input: [[0,0,0],[0,6,0],[0,0,0]],
    ground_truth: [[0,6,0],[6,6,6],[0,6,0]],
    explanation_en: "Draw a cross using the color of the center pixel.",
    explanation_zh: "使用中心像素的颜色画一个十字。"
  },
  {
    id: "custom_3x3_copy_col",
    difficulty: "low",
    train: [
      {
        input: [[1,0,0],[2,0,0],[3,0,0]],
        output: [[1,1,1],[2,2,2],[3,3,3]]
      },
      {
        input: [[4,0,0],[4,0,0],[2,0,0]],
        output: [[4,4,4],[4,4,4],[2,2,2]]
      }
    ],
    test_input: [[5,0,0],[6,0,0],[7,0,0]],
    ground_truth: [[5,5,5],[6,6,6],[7,7,7]],
    explanation_en: "Copy the first column to the second and third columns.",
    explanation_zh: "将第一列的颜色复制到第二和第三列。"
  },
  {
    id: "custom_4x4_diagonal",
    difficulty: "low",
    train: [
      {
        input: [[1,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
        output: [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]]
      },
      {
        input: [[3,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
        output: [[3,0,0,0],[0,3,0,0],[0,0,3,0],[0,0,0,3]]
      }
    ],
    test_input: [[8,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
    ground_truth: [[8,0,0,0],[0,8,0,0],[0,0,8,0],[0,0,0,8]],
    explanation_en: "Draw a diagonal line from top-left to bottom-right using the color of the top-left pixel.",
    explanation_zh: "使用左上角像素的颜色，从左上到右下画一条对角线。"
  },
  {
    id: "custom_4x4_checkerboard",
    difficulty: "low",
    train: [
      {
        input: [[2,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
        output: [[2,0,2,0],[0,2,0,2],[2,0,2,0],[0,2,0,2]]
      },
      {
        input: [[4,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
        output: [[4,0,4,0],[0,4,0,4],[4,0,4,0],[0,4,0,4]]
      }
    ],
    test_input: [[1,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
    ground_truth: [[1,0,1,0],[0,1,0,1],[1,0,1,0],[0,1,0,1]],
    explanation_en: "Create a checkerboard pattern using the color of the top-left pixel.",
    explanation_zh: "使用左上角像素的颜色创建一个棋盘图案。"
  },
  {
    id: "custom_5x5_outline",
    difficulty: "low",
    train: [
      {
        input: [[0,0,0,0,0],[0,0,0,0,0],[0,0,1,0,0],[0,0,0,0,0],[0,0,0,0,0]],
        output: [[0,0,0,0,0],[0,1,1,1,0],[0,1,0,1,0],[0,1,1,1,0],[0,0,0,0,0]]
      },
      {
        input: [[0,0,0,0,0],[0,0,0,0,0],[0,0,3,0,0],[0,0,0,0,0],[0,0,0,0,0]],
        output: [[0,0,0,0,0],[0,3,3,3,0],[0,3,0,3,0],[0,3,3,3,0],[0,0,0,0,0]]
      }
    ],
    test_input: [[0,0,0,0,0],[0,0,0,0,0],[0,0,2,0,0],[0,0,0,0,0],[0,0,0,0,0]],
    ground_truth: [[0,0,0,0,0],[0,2,2,2,0],[0,2,0,2,0],[0,2,2,2,0],[0,0,0,0,0]],
    explanation_en: "Draw a 3x3 outline around the center pixel using its color, leaving the center empty.",
    explanation_zh: "使用中心像素的颜色在其周围画一个 3x3 的轮廓，中心留空。"
  },
  {
    id: "custom_5x5_move_right",
    difficulty: "low",
    train: [
      {
        input: [[0,0,0,0,0],[1,1,0,0,0],[1,1,0,0,0],[0,0,0,0,0],[0,0,0,0,0]],
        output: [[0,0,0,0,0],[0,0,0,1,1],[0,0,0,1,1],[0,0,0,0,0],[0,0,0,0,0]]
      },
      {
        input: [[0,0,0,0,0],[0,0,0,0,0],[2,2,0,0,0],[2,2,0,0,0],[0,0,0,0,0]],
        output: [[0,0,0,0,0],[0,0,0,0,0],[0,0,0,2,2],[0,0,0,2,2],[0,0,0,0,0]]
      }
    ],
    test_input: [[3,3,0,0,0],[3,3,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0]],
    ground_truth: [[0,0,0,3,3],[0,0,0,3,3],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0]],
    explanation_en: "Move the 2x2 colored block to the right edge of the grid.",
    explanation_zh: "将 2x2 的彩色方块移动到网格的右边缘。"
  },
  {
    id: "custom_5x5_gravity",
    difficulty: "low",
    train: [
      {
        input: [[1,0,0,2,0],[0,0,0,0,0],[0,3,0,0,0],[0,0,0,0,0],[0,0,0,0,0]],
        output: [[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[1,3,0,2,0]]
      },
      {
        input: [[0,0,4,0,0],[0,0,0,0,0],[5,0,0,0,0],[0,0,0,6,0],[0,0,0,0,0]],
        output: [[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[5,0,4,6,0]]
      }
    ],
    test_input: [[0,2,0,0,0],[0,0,0,1,0],[0,0,0,0,0],[3,0,0,0,0],[0,0,0,0,0]],
    ground_truth: [[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[3,2,0,1,0]],
    explanation_en: "Apply gravity: move all colored pixels down to the bottom row in their respective columns.",
    explanation_zh: "应用重力：将所有彩色像素在各自的列中移动到最底行。"
  }
];
