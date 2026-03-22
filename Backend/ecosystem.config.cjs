module.exports = {
  apps: [
    {
      name: "ebookmaker-api",
      script: "dist/index.js",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
      },
    },
    {
      name: "ebookmaker-export-worker",
      script: "dist/workers/exportWorker.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
