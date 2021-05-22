const esbuild = require("esbuild");

function build(isServe, onServe) {
  const bundles = {
    counterPageJs: "client/pages/counter/counterPage.tsx",
    counterPageCss: "client/pages/counter/counterPage.css",
  };

  const options = {
    entryPoints: bundles,
    bundle: true,
    outdir: `dist`,
    minify: process.env.NODE_ENV === "production",
    sourcemap: true,
    define: {
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV === "production" ? "production" : "development"),
    },
  };
  if (isServe) {
    esbuild.serve({servedir: "dist"}, options).then((s) => {
      if (onServe != null) {
        onServe(s.host, s.port);
      }
    });
  } else {
    esbuild.build(options);
  }
}

module.exports = { build }

if (process.argv[2] === "start") {
  build(true)
} else if (process.argv[2] === "build") {
  build(false)
}