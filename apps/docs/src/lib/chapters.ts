export const chapters = [
  {
    "slug": "1-setup",
    "title": "Setup & initialization",
    "zh": "环境搭建与初始化",
    "vanilla": "1-setup-and-initialization",
    "vanillaZh": "1-环境搭建与初始化",
    "number": 1,
    "topic": "setup"
  },
  {
    "slug": "2-elements",
    "title": "Nodes & edges",
    "zh": "节点与边",
    "vanilla": "2-basic-node-and-edge-operations",
    "vanillaZh": "2-节点与边的基础操作",
    "number": 2,
    "topic": "elements"
  },
  {
    "slug": "3-layout",
    "title": "Layouts & viewport",
    "zh": "布局与视图",
    "vanilla": "3-layout-and-view-control",
    "vanillaZh": "3-布局与视图控制",
    "number": 3,
    "topic": "layouts"
  },
  {
    "slug": "4-style",
    "title": "Styles & animation",
    "zh": "样式与动画",
    "vanilla": "4-styles-and-animations",
    "vanillaZh": "4-样式与动画",
    "number": 4,
    "topic": "styles"
  },
  {
    "slug": "5-events",
    "title": "Interactions & events",
    "zh": "交互与事件",
    "vanilla": "5-interactions-and-event-handling",
    "vanillaZh": "5-交互与事件处理",
    "number": 5,
    "topic": "events"
  },
  {
    "slug": "6-algorithms",
    "title": "Graph algorithms",
    "zh": "图算法与分析",
    "vanilla": "6-graph-algorithms-and-analysis",
    "vanillaZh": "6-图算法与分析",
    "number": 6,
    "topic": "algorithms"
  },
  {
    "slug": "7-data",
    "title": "Import & export",
    "zh": "数据导入导出",
    "vanilla": "7-data-import-and-export",
    "vanillaZh": "7-数据导入导出",
    "number": 7,
    "topic": "data"
  }
] as const;
export type Language = "en" | "zh-cn";
export function vanillaUrl(chapter: (typeof chapters)[number], lang: Language) { return `/examples/vanilla/${lang}/${chapter.topic}/`; }
