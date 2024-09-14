const path = require("path");
const { DefinePlugin, SourceMapDevToolPlugin } = require("webpack");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const commitHash = require("child_process").execSync("git rev-parse --short HEAD").toString().trim();
const fullCommitHash = require("child_process").execSync("git rev-parse HEAD").toString().trim();
const BundleAnalyzerPlugin = require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

const shared = {
  output: {
    filename: "[name].js",
    publicPath: "/static/",
    path: path.resolve(__dirname, "dist"),
  },
  devtool: false,
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader", "postcss-loader"],
      },
      {
        test: /\.(jpe?g|png|gif|svg)$/i,
        loader: "file-loader",
        options: {
          name: "/images/[name].[ext]",
        },
      },
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: "ts-loader",
            options: {
              transpileOnly: true,
              configFile: "tsconfig.json",
            },
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".css"],
  },
  plugins: [
    new SourceMapDevToolPlugin({
      append: `\n//# sourceMappingURL=[file].map?version=${commitHash}`,
      filename: "[file].map",
    }),
    new MiniCssExtractPlugin(),
    new DefinePlugin({
      __COMMIT_HASH__: JSON.stringify(commitHash),
      __FULL_COMMIT_HASH__: JSON.stringify(fullCommitHash),
      __ENV__: JSON.stringify(process.env.NODE_ENV === "production" ? "production" : "development"),
    }),
  ],
  mode: process.env.NODE_ENV === "production" ? "production" : "development",
};

// Export a function. Accept the base config as the only param.
module.exports = [
  {
    ...shared,
    entry: {
      counterPage: ["./client/pages/counter/counterPage.tsx"],
    },
    devServer: {
      static: path.join(__dirname, "dist"),
      compress: false,
      hot: false,
      allowedHosts: "all",
      liveReload: false,
      host: "0.0.0.0",
    },
  },
  {
    ...shared,
    entry: {
      devserver: ["./devserver"],
    },
    target: "node",
  },
  {
    ...shared,
    output: {
      filename: "[name].js",
      publicPath: "/static/",
      path: path.resolve(__dirname, "dist-server"),
      libraryTarget: "commonjs2",
    },
    entry: {
      index: ["./server/index.ts"],
    },
    plugins: [...shared.plugins],
    mode: "development",
    target: "node",
  },
];
