import * as esbuild from "esbuild";

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",

  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started");
    });
    build.onEnd((result) => {
      for (const { text, location } of result.errors) {
        console.error(`✘ [ERROR] ${text}`);
        if (location == null) {
          continue;
        }
        console.error(`    ${location.file}:${location.line}:${location.column}:`);
      }
      console.log("[watch] build finished");
    });
  },
};

// The client and the server are separate node entry points, so each one is bundled on its own.
const bundles = [
  { entryPoints: ["client/src/extension.ts"], outfile: "dist/extension.js" },
  { entryPoints: ["server/src/server.ts"], outfile: "dist/server.js" },
];

const contexts = await Promise.all(
  bundles.map((bundle) =>
    esbuild.context({
      ...bundle,
      bundle: true,
      format: "cjs",
      minify: production,
      sourcemap: !production,
      sourcesContent: false,
      platform: "node",
      external: ["vscode"],
      logLevel: "warning",
      // add to the end of plugins array
      plugins: [esbuildProblemMatcherPlugin],
    }),
  ),
);

if (watch) {
  await Promise.all(contexts.map((ctx) => ctx.watch()));
} else {
  await Promise.all(contexts.map((ctx) => ctx.rebuild()));
  await Promise.all(contexts.map((ctx) => ctx.dispose()));
}
