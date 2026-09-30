const minorOnly = ["typescript", "@types/node"];

export default {
  dep: "prod,dev,peer",
  target: (name) => (minorOnly.includes(name) ? "minor" : "greatest"),
  pre: 0,
  cooldown: "7d",
};
