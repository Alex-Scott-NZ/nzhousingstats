module.exports = {
  apps: [{
    name: 'nzhousingstats',
    script: 'pnpm',
    args: 'start -- -p 3001',
    cwd: '/home/madebyalex/web/nzhousingstats.madebyalex.dev/app/source',
    node_args: '--max-old-space-size=2048',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
