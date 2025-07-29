module.exports = {
  apps: [{
    name: 'nzhousingstats',
    script: 'pnpm',
    args: 'start',
    cwd: '/home/madebyalex/web/nzhousingstats.madebyalex.dev/app/source',
    node_args: '--max-old-space-size=2048',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
};
