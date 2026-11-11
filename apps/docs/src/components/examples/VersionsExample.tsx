"use client";
import { CompareView } from "@cytocausal/react";
import "@cytocausal/react/styles.css";
import { versionedDataset } from "./data.ts";

export default function VersionsExample() {
  return <CompareView dataset={versionedDataset} left="draft" right="reviewed" />;
}
