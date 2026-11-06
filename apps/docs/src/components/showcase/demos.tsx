"use client";
import { createCausalStyle } from "@cytocausal/cytoscape";
import {
  CausalGraph,
  CausalProvider,
  CausalRoot,
  CausalWorkspace,
  CompareView,
  DepthControl,
  GraphView,
  Legend,
  LoopList,
  NodeSearch,
  SelectionPanel,
  themeForScheme,
  VersionDiff,
  VersionSwitcher,
} from "@cytocausal/react";
import "@cytocausal/react/styles.css";
import { useTheme } from "nextra-theme-docs";
import { useMemo, useState, type ReactNode } from "react";
import { dataset } from "./data.ts";
import "./showcase.css";

/** Follows the docs' light or dark setting. */
function useDocsScheme() {
  return useTheme().resolvedTheme === "dark" ? ("dark" as const) : ("light" as const);
}

export function WorkspaceDemo() {
  return (
    <div className="showcase-frame showcase-workspace">
      <CausalWorkspace
        dataset={dataset}
        title="Coffee shop"
        scheme={useDocsScheme()}
        shareInUrl={false}
      />
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
  const theme = themeForScheme(useDocsScheme());
  const [node, setNode] = useState<"dot" | "pill">("pill");
  const [link, setLink] = useState<"bezier" | "flowing" | "straight">("flowing");
  const stylesheet = useMemo(() => createCausalStyle(theme, { node, link }), [theme, node, link]);

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
          stylesheet={stylesheet}
          motion={theme.motion}
        />
      </div>
    </CausalRoot>
  );
}

export function CompareDemo() {
  const theme = themeForScheme(useDocsScheme());
  const stylesheet = useMemo(() => createCausalStyle(theme), [theme]);
  return (
    <CausalRoot theme={theme} className="showcase-frame showcase-compare">
      <CompareView
        dataset={dataset}
        left="V1"
        right="final"
        stylesheet={stylesheet}
        motion={theme.motion}
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
    SelectionPanel: "Shows the selected nodes, and the paths between them.",
    LoopList: "Lists feedback loops, and highlights the one you choose.",
    VersionDiff: "Summarises what changed between two snapshots.",
  },
  zh: {
    NodeSearch: "按标签或证据查找节点，并把视图移到所选节点。",
    VersionSwitcher: "在快照之间切换。",
    Legend: "说明高亮颜色的含义。",
    DepthControl: "设置高亮延伸到几条连线之外。",
    SelectionPanel: "显示选中的节点，以及它们之间的路径。",
    LoopList: "列出反馈回路，并高亮你选择的回路。",
    VersionDiff: "总结两个快照之间的变化。",
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

/** Every panel on its own, all connected through one provider. */
export function GalleryDemo({ language = "en" }: { language?: keyof typeof descriptions }) {
  const text = descriptions[language];
  return (
    <CausalProvider
      dataset={dataset}
      scheme={useDocsScheme()}
      initialVersion="final"
      initialSelected={["customers", "queue"]}
      className="showcase-frame showcase-gallery"
    >
      <CausalGraph className="showcase-sticky" />
      <div className="showcase-cards">
        <Card name="NodeSearch" text={text.NodeSearch}>
          <NodeSearch />
        </Card>
        <Card name="VersionSwitcher" text={text.VersionSwitcher}>
          <VersionSwitcher />
        </Card>
        <Card name="Legend" text={text.Legend}>
          <Legend />
        </Card>
        <Card name="DepthControl" text={text.DepthControl}>
          <DepthControl />
        </Card>
        <Card name="SelectionPanel" text={text.SelectionPanel}>
          <SelectionPanel />
        </Card>
        <Card name="LoopList" text={text.LoopList}>
          <LoopList />
        </Card>
        <Card name="VersionDiff" text={text.VersionDiff}>
          <VersionDiff />
        </Card>
      </div>
    </CausalProvider>
  );
}
