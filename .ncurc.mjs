// Don't upgrade vscode-languageserver/client to v10 until the lsp-sample does.
// v10 requires engines.vscode ^1.91.0, which would drop VS Code 1.75-1.90 support.
const minorOnly = ["typescript", "@types/node", "vscode-languageserver", "vscode-languageclient"];

export default {
  dep: "prod,dev,peer",
  target: (name) => (minorOnly.includes(name) ? "minor" : "greatest"),
  pre: 0,
  cooldown: "7d",
};
