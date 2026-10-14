import { existsSync } from "node:fs";
import * as path from "node:path";

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

// The Junos schema: server/src/junos.js (built by junoser from Juniper's XSD, checked in), unless a local schema
// is present, e.g. one built from Junos DDL files with junos-ddl-schema. JUNOS_SCHEMA=path overrides both.
const localSchema = path.resolve("server/src/junos.local.js");
let schema;
if (process.env.JUNOS_SCHEMA) {
  schema = path.resolve(process.env.JUNOS_SCHEMA);
} else if (existsSync(localSchema)) {
  schema = localSchema;
}

/**
 * @type {import('esbuild').Plugin}
 */
const junosSchemaPlugin = {
  name: "junos-schema",

  setup(build) {
    if (!schema) {
      return;
    }
    console.log(`using Junos schema ${schema}`);
    build.onResolve({ filter: /\/junos$/ }, (args) =>
      args.importer.endsWith(path.join("server", "src", "parser.ts")) ? { path: schema } : undefined,
    );
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
      plugins: [...(bundle.outfile.endsWith("server.js") ? [junosSchemaPlugin] : []), esbuildProblemMatcherPlugin],
    }),
  ),
);

if (watch) {
  await Promise.all(contexts.map((ctx) => ctx.watch()));
} else {
  await Promise.all(contexts.map((ctx) => ctx.rebuild()));
  await Promise.all(contexts.map((ctx) => ctx.dispose()));
}
