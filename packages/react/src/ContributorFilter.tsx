"use client";
import type { ContributorSummary } from "@cytocausal/core";
import { required, useOptionalCausal } from "./CausalProvider.tsx";
import { useCausalLabels } from "./labels.tsx";

/**
 * Chooses whose nodes and links are shown. Hidden parts keep their place, so the graph stays
 * comparable. It shows nothing when fewer than two people contributed, unless some are chosen,
 * such as in a version they didn't contribute to. Outside a provider, pass `contributors`,
 * `chosen` and `onChange`.
 */
export function ContributorFilter({
  contributors: given,
  chosen: picked,
  onChange: changed,
  className = "",
}: {
  contributors?: ContributorSummary[];
  /** Whose parts are shown. Null shows everyone's. */
  chosen?: string[] | null;
  onChange?: (chosen: string[] | null) => void;
  className?: string;
}) {
  const labels = useCausalLabels();
  const causal = useOptionalCausal();
  const listed = required(given ?? causal?.contributorList, "ContributorFilter", "contributors");
  const chosen = picked !== undefined ? picked : (causal?.contributors ?? null);
  const onChange = required(changed ?? causal?.setContributors, "ContributorFilter", "onChange");
  // People chosen elsewhere stay listed, so the choice can always be undone
  const absent = (chosen ?? []).filter((name) => !listed.some((item) => item.contributor === name));
  const contributors = [...listed, ...absent.map((contributor) => ({ contributor, nodes: 0, links: 0 }))];
  if (listed.length < 2 && !chosen) return null;

  const toggle = (name: string) => {
    const current = chosen ?? [];
    const next = current.includes(name)
      ? current.filter((item) => item !== name)
      : [...current, name];
    onChange(next.length > 0 ? next : null);
  };

  return (
    <section className={`cc-panel ${className}`} aria-label={labels.contributors}>
      <div className="cc-spread">
        <h3 className="cc-heading">
          {labels.contributors} ({contributors.length})
        </h3>
        <button
          type="button"
          className="cc-link"
          aria-pressed={chosen === null}
          onClick={() => onChange(null)}
        >
          {labels.everyone}
        </button>
      </div>
      <ul className="cc-list">
        {contributors.map(({ contributor, links }) => (
          <li key={contributor}>
            <label className="cc-check cc-row">
              <input
                type="checkbox"
                checked={chosen?.includes(contributor) ?? false}
                onChange={() => toggle(contributor)}
              />
              <span>{contributor}</span>
              <span className="cc-muted">{labels.contributorLinks(links)}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
