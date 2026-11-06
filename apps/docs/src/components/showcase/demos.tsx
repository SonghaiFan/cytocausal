"use client";
import {
  autoLayout,
  createCausalStyle,
  type CausalStyleOptions,
  type CausalTheme,
} from "@cytocausal/cytoscape";
import {
  CausalRoot,
  CausalWorkspace,
  CompareView,
  DepthControl,
  GraphView,
  Legend,
  LoopList,
  NodeDetails,
  NodeSearch,
  NodeTooltip,
  PathList,
  themeForScheme,
  useCausalGraph,
  VersionDiff,
  VersionSwitcher,
  ZoomControls,
} from "@cytocausal/react";
import "@cytocausal/react/styles.css";
import { findFeedbackLoops, type CausalNode } from "@cytocausal/core";
import { useTheme } from "nextra-theme-docs";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { dataset } from "./data.ts";
import "./showcase.css";

const renderTooltip = (node: CausalNode) => <NodeTooltip node={node} />;

/** Follows the docs' light or dark setting. */
function useDocsTheme() {
  const { resolvedTheme } = useTheme();
  return themeForScheme(resolvedTheme === "dark" ? "dark" : "light");
}

function useStyle(theme: CausalTheme, options?: CausalStyleOptions) {
  return useMemo(() => createCausalStyle(theme, options), [theme, options]);
}

export function WorkspaceDemo() {
  return (
    <div className="showcase-frame showcase-workspace">
      <CausalWorkspace dataset={dataset} title="Coffee shop" shareInUrl={false} />
    </div>
  );
}

function Choice<T extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={title} className="cc-buttons">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className="cc-button"
          aria-pressed={option === value}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function StyleDemo() {
  const theme = useDocsTheme();
  const [node, setNode] = useState<"dot" | "pill">("pill");
  const [link, setLink] = useState<"bezier" | "flowing" | "straight">("flowing");
  const options = useMemo(() => ({ node, link }), [node, link]);
  const stylesheet = useStyle(theme, options);
  const positionCache = useRef({});

  return (
    <CausalRoot theme={theme} className="showcase-frame showcase-style">
      <div className="showcase-toolbar">
        <Choice title="Node style" options={["dot", "pill"]} value={node} onChange={setNode} />
        <Choice
          title="Link style"
          options={["bezier", "flowing", "straight"]}
          value={link}
          onChange={setLink}
        />
        <code>{`createCausalStyle(theme, { node: "${node}", link: "${link}" })`}</code>
      </div>
      <div className="showcase-canvas">
        <GraphView
          dataset={dataset}
          snapshotId="final"
          layout={autoLayout}
          stylesheet={stylesheet}
          motion={theme.motion}
          positionCache={positionCache}
        />
      </div>
    </CausalRoot>
  );
}

export function CompareDemo() {
  const theme = useDocsTheme();
  const stylesheet = useStyle(theme);
  const positionCache = useRef({});
  return (
    <CausalRoot theme={theme} className="showcase-frame showcase-compare">
      <CompareView
        dataset={dataset}
        left="V1"
        right="final"
        layout={autoLayout}
        stylesheet={stylesheet}
        motion={theme.motion}
        positionCache={positionCache}
      />
    </CausalRoot>
  );
}

const descriptions = {
  en: {
    NodeSearch: "Finds nodes by label or evidence, and moves the view to the choice.",
    VersionSwitcher: "Switches between snapshots.",
    Legend: "Explains the highlight colours.",
    DepthControl: "Sets how many links away the highlight reaches.",
    PathList: "Lists the paths between two selected nodes, in both directions.",
    NodeDetails: "Shows a node's evidence, causes, effects and loops.",
    LoopList: "Lists feedback loops, and highlights the one you choose.",
    VersionDiff: "Summarises what changed between two snapshots.",
    selectTwo: "Select two nodes to see this.",
  },
  zh: {
    NodeSearch: "按标签或证据查找节点，并把视图移到所选节点。",
    VersionSwitcher: "在快照之间切换。",
    Legend: "说明高亮颜色的含义。",
    DepthControl: "设置高亮延伸到几条连线之外。",
    PathList: "列出两个选中节点之间双向的路径。",
    NodeDetails: "显示节点的证据、原因、结果和回路。",
    LoopList: "列出反馈回路，并高亮你选择的回路。",
    VersionDiff: "总结两个快照之间的变化。",
    selectTwo: "选中两个节点后显示。",
  },
};

function Card({ name, text, children }: { name: string; text: string; children: ReactNode }) {
  return (
    <article className="showcase-card" aria-label={name}>
      <h3>
        <code>{name}</code>
      </h3>
      <p>{text}</p>
      {children}
    </article>
  );
}

/** Every panel on its own, all connected to one graph. */
export function GalleryDemo({ language = "en" }: { language?: keyof typeof descriptions }) {
  const text = descriptions[language];
  const theme = useDocsTheme();
  const stylesheet = useStyle(theme);
  const [version, setVersion] = useState("final");
  const graph = useCausalGraph({
    maxSelected: 2,
    motion: theme.motion,
    initialSelected: ["customers", "queue"],
  });
  const snapshot = dataset.snapshots.find(({ id }) => id === version)!;
  const [from, to] = graph.selected;
  const positionCache = useRef({});
  const { loops, complete } = useMemo(() => findFeedbackLoops(snapshot), [snapshot]);

  return (
    <CausalRoot theme={theme} className="showcase-frame showcase-gallery">
      <div className="cc-graph showcase-sticky">
        <GraphView
          dataset={dataset}
          snapshotId={version}
          layout={autoLayout}
          stylesheet={stylesheet}
          motion={theme.motion}
          positionCache={positionCache}
          animateSnapshots
          renderTooltip={renderTooltip}
          onReady={graph.attach}
        />
        <ZoomControls graph={graph} />
        <p role="status" className="cc-sr-only">
          {graph.announcement}
        </p>
      </div>
      <div className="showcase-cards">
        <Card name="NodeSearch" text={text.NodeSearch}>
          <NodeSearch nodes={snapshot.nodes} onSelect={graph.focus} />
        </Card>
        <Card name="VersionSwitcher" text={text.VersionSwitcher}>
          <VersionSwitcher
            versions={dataset.snapshots.map(({ id }) => id)}
            value={version}
            onChange={(id) => {
              graph.clear();
              setVersion(id);
            }}
          />
        </Card>
        <Card name="Legend" text={text.Legend}>
          <Legend />
        </Card>
        <Card name="DepthControl" text={text.DepthControl}>
          <DepthControl value={graph.depth} onChange={graph.setDepth} />
        </Card>
        <Card name="PathList" text={text.PathList}>
          {to ? (
            <PathList
              snapshot={snapshot}
              from={from}
              to={to}
              active={graph.activeLoop}
              onToggle={graph.toggleLoop}
            />
          ) : (
            <p className="cc-panel cc-muted">{text.selectTwo}</p>
          )}
        </Card>
        <Card name="NodeDetails" text={text.NodeDetails}>
          {from ? (
            <NodeDetails
              snapshot={snapshot}
              nodeId={from}
              onSelect={graph.focus}
              onClose={() => graph.toggle(from)}
            />
          ) : (
            <p className="cc-panel cc-muted">{text.selectTwo}</p>
          )}
        </Card>
        <Card name="LoopList" text={text.LoopList}>
          <LoopList
            snapshot={snapshot}
            loops={loops}
            complete={complete}
            active={graph.activeLoop}
            onToggle={graph.toggleLoop}
          />
        </Card>
        <Card name="VersionDiff" text={text.VersionDiff}>
          <VersionDiff dataset={dataset} from="V1" to="final" />
        </Card>
      </div>
    </CausalRoot>
  );
}
