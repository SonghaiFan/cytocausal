"use client";
import dynamic from "next/dynamic";
export const AppLoader = dynamic(() => import("./Studio.tsx"), { ssr: false, loading: () => <p className="loading">Opening your canvas…</p> });
