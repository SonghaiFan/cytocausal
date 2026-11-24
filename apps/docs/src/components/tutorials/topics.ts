export const tutorialChapters = [
  { topic: "setup", title: "Setup & initialization", zh: "环境搭建与初始化" },
  { topic: "elements", title: "Nodes & edges", zh: "节点与边" },
  { topic: "layouts", title: "Layouts & viewport", zh: "布局与视图" },
  { topic: "styles", title: "Styles & animation", zh: "样式与动画" },
  { topic: "events", title: "Interactions & events", zh: "交互与事件" },
  { topic: "algorithms", title: "Graph algorithms", zh: "图算法与分析" },
  { topic: "data", title: "Import & export", zh: "数据导入导出" },
] as const;
export type TutorialTopic = typeof tutorialChapters[number]["topic"];

export const commandTopics: readonly TutorialTopic[] = ["elements", "events", "data"];
