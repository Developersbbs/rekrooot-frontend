module.exports = {
  apps: [
    {
      name: "rekrooot-frontend",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 3012
      }
    }
  ]
};
