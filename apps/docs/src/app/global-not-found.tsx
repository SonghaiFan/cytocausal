import Link from "next/link";
export const metadata = { title: "Page not found | cytocausal" };

/** Paths outside the guides and demos have no site shell to render inside. */
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "20vh 1rem" }}>
        <h1>Page not found</h1>
        <Link href="/en/">Return to the docs</Link>
      </body>
    </html>
  );
}
