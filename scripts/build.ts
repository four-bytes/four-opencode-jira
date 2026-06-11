import { rmSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });

// 1. TUI build: tsc preserves JSX → .jsx + .d.ts
await Bun.$`bunx tsc`;

// 2. Server build: Bun bundler
const server = await Bun.build({
  entrypoints: ["src/four-opencode-jira.ts"],
  outdir: "dist",
  target: "bun",
  external: ["@opencode-ai/*"],
  minify: process.env.NODE_ENV === "production",
});

if (!server.success) {
  for (const log of server.logs) console.error(log);
  process.exit(1);
}

for (const out of server.outputs) {
  console.log(`  ${out.path.padEnd(46)} ${(out.size / 1024).toFixed(2)} KB`);
}
for (const f of ["dist/tui.jsx", "dist/tui.d.ts", "dist/four-opencode-jira.d.ts"]) {
  const file = Bun.file(f);
  if (await file.exists()) {
    const size = (await file.arrayBuffer()).byteLength;
    console.log(`  ${f.padEnd(46)} ${(size / 1024).toFixed(2)} KB`);
  }
}
console.log(`\n✅ Built (tsc TUI + Bun server)`);
