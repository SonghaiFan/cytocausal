import { appLinks } from "./app-links.ts";
import Link from "next/link";
import { assetPath } from "./site-path.ts";
import { WorkspaceDemo } from "./showcase/index.tsx";
import "./home.css";
import "./showcase/showcase.css";

export function Home({ lang }: { lang: "en" | "zh-cn" }) {
  const zh = lang === "zh-cn";
  const link = (page: string) => `/${lang}/${page}/`;
  return (
    <div className="cc-home">
      <header className="cc-home-hero">
        <p className="cc-home-eyebrow"><img src={assetPath("/brand/mark.svg")}  width="48" height="48" alt="" /><img className="cc-wordmark-light" src={assetPath("/brand/wordmark.svg")} width="208" height="40" alt="cytocausal" /><img className="cc-wordmark-dark" src={assetPath("/brand/wordmark-dark.svg")} width="208" height="40" alt="cytocausal" /><span>causal graph library</span></p>
        <h1>{zh ? "让因果图成为可以探索的界面。" : "Make causal graphs something you can explore."}</h1>
        <p className="cc-home-lead">{zh
          ? "基于 Cytoscape.js，为因果图提供专门的交互、可组合的 React 组件与分析 API。从证据到反馈回路，从一个版本到另一个版本。"
          : "Causal graph interactions, composable React components and analysis APIs, built on Cytoscape.js. From evidence to feedback loops. From one version to the next."}</p>
        <div className="cc-home-actions">
          <Link className="cc-home-primary" href={link("showcase")}>{zh ? "体验 Showcase" : "Explore the showcase"} →</Link>
          <Link href={link("getting-started")}>{zh ? "从 Starter 开始" : "Build with the starter"} →</Link>
        </div>
      </header>

      <section aria-labelledby="home-demo">
        <div className="cc-home-section-head">
          <h2 id="home-demo">{zh ? "先试一张小图" : "Start with a small graph"}</h2>
          <p>{zh ? "虚构的咖啡店模型 · 可直接操作" : "A fictional coffee shop model · live and interactive"}</p>
        </div>
        <WorkspaceDemo initialSelected={["customers"]} />
        <p className="cc-home-caption">{zh ? "点击节点探索原因与结果；切换 V1 / final 查看变化；选择反馈回路查看它经过的节点。示例图中的标签为英文。" : "Select a node to explore causes and effects. Switch V1 / final to see changes. Select a feedback loop to follow its nodes."}</p>
      </section>

      <section className="cc-home-capabilities" aria-labelledby="home-library">
        <div>
          <p className="cc-home-eyebrow">{zh ? "Library" : "The library"}</p>
          <h2 id="home-library">{zh ? "围绕因果关系设计的交互与 API。" : "Interactions and APIs shaped around cause and effect."}</h2>
          <p>{zh ? "在 Cytoscape.js 渲染之上，加入因果语义、证据追溯、版本对应与交互组件，作为应用共享的基础。" : "A shared foundation for applications: causal semantics, provenance, version correspondence and interface components on top of Cytoscape.js rendering."}</p>
          <Link href={link("components")}>{zh ? "查看组件与接入方式" : "Explore components and integration"} →</Link>
        </div>
        <dl>
          <div><dt><Link href={link("provenance")}>{zh ? "追溯每个关系的依据" : "Trace the evidence"} →</Link></dt><dd>{zh ? "保留节点和连线的出处与贡献者，查看多人模型中的共识与分歧。" : "Keep sources and contributors attached to nodes and links. Read agreement and disagreement across people's models."}</dd></div>
          <div><dt><Link href={link("version-transitions")}>{zh ? "看清版本之间的变化" : "Compare changes over time"} →</Link></dt><dd>{zh ? "用明确的节点对应关系处理改名、合并与拆分，让布局帮助读者跟随变化。" : "Follow renames, merges and splits through explicit node correspondences and stable layouts."}</dd></div>
          <div><dt><Link href={link("causal-analysis")}>{zh ? "探索路径与反馈回路" : "Explore paths and feedback"} →</Link></dt><dd>{zh ? "沿原因与结果探索，查找有向路径，并在极性信息完整时区分增强与平衡回路。" : "Navigate causes and effects, find directed paths, and distinguish reinforcing and balancing loops when polarity is known."}</dd></div>
        </dl>
      </section>

      <section aria-labelledby="home-apps">
        <h2 id="home-apps">{zh ? "同一个 Library，两条应用路径" : "One library. Two ways to build on it."}</h2>
        <div className="cc-home-paths">
          <div><p className="cc-home-eyebrow">{zh ? "Studio · 在线绘图" : "Studio · online drawing"}</p><h3>{zh ? "在浏览器中创作因果图" : "Author causal graphs in the browser"}</h3><p>{zh ? "在浏览器中添加节点与连线、编辑名称和极性，再切换到探索模式。自动保存在当前浏览器，支持 JSON 导入导出。" : "Add nodes and links, edit labels and polarity, then switch to exploration. Saved in this browser, with JSON import and export."}</p><Link href={appLinks.studio}>{zh ? "打开 Studio" : "Open Studio"} ↗</Link></div>
          <div><p className="cc-home-eyebrow">{zh ? "Starter · 现在可用" : "Starter · available now"}</p><h3>{zh ? "构建自己的项目" : "Build your own project"}</h3><p>{zh ? "克隆 React / Next.js starter，换上自己的数据。使用完整 Workspace，也可以组合组件，自定义研究工具或产品界面。" : "Clone the React / Next.js starter and bring your data. Use the complete workspace or compose its components into your own research tool or product."}</p><Link href={link("getting-started")}>{zh ? "开始构建" : "Get started"} →</Link></div>
        </div>
      </section>

      <section aria-labelledby="home-cases">
        <div className="cc-home-section-head"><h2 id="home-cases">{zh ? "在真实项目中使用" : "See it in real projects"}</h2><Link href={link("showcase")}>{zh ? "查看全部交互示例" : "See the interactive showcase"} →</Link></div>
        <div className="cc-home-cases">
          <Link href={link("case-perspectiva")}><img src={assetPath("/images/perspectiva-compare.png")}  alt={zh ? "Perspectiva 的因果图版本并排比较" : "Causal graph versions compared side by side in Perspectiva"} loading="lazy" /><h3>Perspectiva →</h3><p>{zh ? "参与式建模：比较因果回路图的版本，追溯术语与不同参与者的视角。" : "Participatory modelling: compare diagram versions and trace terms across participants' perspectives."}</p></Link>
          <Link href={link("case-explorer")}><img src={assetPath("/images/explorer-selection.png")}  alt={zh ? "Causal Explorer 中选中节点的原因与结果" : "Causes and effects of a selected node in Causal Explorer"} loading="lazy" /><h3>Causal Explorer →</h3><p>{zh ? "因果网络探索：搜索事件，阅读原始描述，沿原因、结果与反馈回路导航。" : "Causal network exploration: find events, read source descriptions and navigate causes, effects and feedback."}</p></Link>
        </div>
      </section>
      <footer className="cc-home-end"><p>{zh ? "目前通过源码工作区与 starter 使用；包尚未发布为可安装的 npm 版本。代码与文档采用 MIT 许可，案例数据另有使用条款。" : "Currently used through the source workspace and starter; installable npm packages are not yet published. Code and docs are MIT licensed; case-study data has separate terms."}</p><Link href={link("brand")}>{zh ? "视觉识别" : "Visual identity"} →</Link><Link href="https://github.com/SonghaiFan/cytocausal">GitHub →</Link></footer>
    </div>
  );
}
