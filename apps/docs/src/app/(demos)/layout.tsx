import type { ReactNode } from "react";
import "../../components/tutorials/standalone.css";
export default function DemoRoot({ children }: { children: ReactNode }) {
  return <html><body>{children}</body></html>;
}
