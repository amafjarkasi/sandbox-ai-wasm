/**
 * Real-World Example: Scheduled Task Runner
 * 
 * Execute cron job logic safely
 */

async function runScheduledTask(taskType, config = {}) {
  const tasks = {
    dailyReport: \`
      const config = JSON.parse(process.env.TASK_CONFIG);
      
      // Generate daily analytics report
      const report = {
        date: new Date().toISOString().split('T')[0],
        summary: {
          totalUsers: 15420,
          newUsers: 145,
          activeUsers: 8934,
          revenue: 12580.50
        },
        metrics: {
          pageViews: 452300,
          avgSessionDuration: '4m 32s',
          bounceRate: '34.2%'
        },
        topPages: [
          { path: '/', views: 125000 },
          { path: '/products', views: 89300 },
          { path: '/pricing', views: 45600 }
        ]
      };
      
      console.log(JSON.stringify({
        task: 'daily_report',
        status: 'completed',
        report: report,
        generatedAt: new Date().toISOString()
      }));
    \\\`,
    
    cleanup: \`
      const config = JSON.parse(process.env.TASK_CONFIG);
      
      // Simulate cleanup operations
      const cleanupResults = {
        tempFilesDeleted: 145,
        oldLogsArchived: 23,
        cacheCleared: true,
        databaseOptimized: true,
        spaceReclaimed: '2.3 GB'
      };
      
      console.log(JSON.stringify({
        task: 'cleanup',
        status: 'completed',
        results: cleanupResults,
        completedAt: new Date().toISOString()
      }));
    \\\`,
    
    healthCheck: \`
      const config = JSON.parse(process.env.TASK_CONFIG);
      
      // Simulate health checks
      const checks = [
        { service: 'database', status: 'healthy', latency: '12ms' },
        { service: 'cache', status: 'healthy', latency: '3ms' },
        { service: 'api', status: 'healthy', latency: '45ms' },
        { service: 'queue', status: 'healthy', latency: '8ms' }
      ];
      
      const allHealthy = checks.every(c => c.status === 'healthy');
      
      console.log(JSON.stringify({
        task: 'health_check',
        status: allHealthy ? 'healthy' : 'degraded',
        checks: checks,
        timestamp: new Date().toISOString()
      }));
    \\\`,
    
    backup: \`
      const config = JSON.parse(process.env.TASK_CONFIG);
      
      // Simulate backup operation
      const backupInfo = {
        type: config.backupType || 'full',
        databases: ['users', 'orders', 'analytics'],
        filesProcessed: 15420,
        size: '4.7 GB',
        duration: '12m 34s',
        location: 's3://backups/daily/',
        checksum: 'a1b2c3d4e5f6'
      };
      
      console.log(JSON.stringify({
        task: 'backup',
        status: 'completed',
        backup: backupInfo,
        completedAt: new Date().toISOString()
      }));
    \\\
  };

  const code = tasks[taskType];
  if (!code) {
    throw new Error(\`Unknown task type: \${taskType}\`);
  }

  const response = await fetch('http://localhost:3000/api/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer your-api-key'
    },
    body: JSON.stringify({
      code,
      context: { TASK_CONFIG: JSON.stringify(config) },
      policy: {
        timeout: 30000,
        memory: '128mb',
        network: 'outbound',
        filesystem: 'readonly'
      }
    })
  });

  const result = await response.json();
  
  if (result.status === 'completed') {
    return JSON.parse(result.output);
  } else {
    throw new Error(result.error);
  }
}

// Example: Run all scheduled tasks
async function runAllTasks() {
  console.log('=== Running Scheduled Tasks ===\n');
  
  // Task 1: Daily Report
  console.log('1. Generating Daily Report...');
  const report = await runScheduledTask('dailyReport');
  console.log(\`   Status: \${report.status}\`);
  console.log(\`   Revenue: \$\${report.report.summary.revenue}\`);
  console.log(\`   Active Users: \${report.report.summary.activeUsers}\`);
  
  // Task 2: Health Check
  console.log('\n2. Running Health Checks...');
  const health = await runScheduledTask('healthCheck');
  console.log(\`   Overall Status: \${health.status}\`);
  health.checks.forEach(check => {
    console.log(\`   - \${check.service}: \${check.status} (\${check.latency})\`);
  });
  
  // Task 3: Cleanup
  console.log('\n3. Running Cleanup...');
  const cleanup = await runScheduledTask('cleanup');
  console.log(\`   Status: \${cleanup.status}\`);
  console.log(\`   Space Reclaimed: \${cleanup.results.spaceReclaimed}\`);
  console.log(\`   Files Deleted: \${cleanup.results.tempFilesDeleted}\`);
  
  // Task 4: Backup
  console.log('\n4. Running Backup...');
  const backup = await runScheduledTask('backup', { backupType: 'incremental' });
  console.log(\`   Status: \${backup.status}\`);
  console.log(\`   Size: \${backup.backup.size}\`);
  console.log(\`   Duration: \${backup.backup.duration}\`);
  
  console.log('\n=== All Tasks Completed ===');
}

runAllTasks().catch(console.error);
