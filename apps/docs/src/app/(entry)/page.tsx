"use client";
import { useEffect } from "react";
import Link from "next/link";
import { assetPath } from "../../components/site-path.ts";
export default function Entry() {
  useEffect(() => {
    const chinese = document.cookie.split(";").some(value => value.trim() === "NEXT_LOCALE=zh-cn");
    location.replace(assetPath(chinese ? "/zh-cn/" : "/en/"));
  }, []);
  return <main><h1>cytocausal</h1><Link href="/en/">English</Link> · <Link href="/zh-cn/">简体中文</Link></main>;
}
