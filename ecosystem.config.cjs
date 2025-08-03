module.exports = {
  apps: [
    {
      name: 'nzhousingstats',
      script: 'pnpm',
      args: 'start',
      cwd: '/home/madebyalex/web/nzhousingstats.madebyalex.dev/app/source',
      node_args: '--max-old-space-size=2048',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    },
    {
      name: 'nzhousingstats-collector',
      script: 'npx',
      args: 'tsx scripts/data-collection-job.js',
      cwd: '/home/madebyalex/web/nzhousingstats.madebyalex.dev/app/source',
      node_args: '--max-old-space-size=1024',
      env: {
        NODE_ENV: 'production'
      },
      autorestart: true,
      watch: false
    }
  ]
};
