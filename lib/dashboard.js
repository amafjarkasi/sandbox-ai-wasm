/**
 * SandboxAI - Dashboard
 * Real-time monitoring dashboard with SSE updates
 */

class Dashboard {
  constructor({ executor, executionQueue, engineManager }) {
    this.executor = executor;
    this.executionQueue = executionQueue;
    this.engineManager = engineManager;
  }

  /**
   * Render the dashboard HTML
   */
  render() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SandboxAI Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f0f23;
      color: #e0e0e0;
      line-height: 1.6;
    }
    .header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      padding: 2rem;
      border-bottom: 1px solid #2d2d44;
    }
    .header h1 {
      font-size: 2rem;
      background: linear-gradient(90deg, #00d4ff, #7b2cbf);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
    }
    .header p { color: #888; }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    .card {
      background: #1a1a2e;
      border-radius: 12px;
      padding: 1.5rem;
      border: 1px solid #2d2d44;
      transition: transform 0.2s, border-color 0.2s;
    }
    .card:hover {
      transform: translateY(-2px);
      border-color: #00d4ff;
    }
    .card h3 {
      color: #00d4ff;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1rem;
    }
    .stat-value {
      font-size: 2.5rem;
      font-weight: 700;
      color: #fff;
    }
    .stat-label {
      color: #888;
      font-size: 0.875rem;
    }
    .engine-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }
    .engine-card {
      background: #0f0f23;
      border-radius: 8px;
      padding: 1rem;
      border: 1px solid #2d2d44;
    }
    .engine-card.available {
      border-left: 3px solid #00d4ff;
    }
    .engine-card.unavailable {
      border-left: 3px solid #666;
      opacity: 0.6;
    }
    .engine-name {
      font-weight: 600;
      color: #fff;
    }
    .engine-meta {
      font-size: 0.75rem;
      color: #888;
      margin-top: 0.25rem;
    }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }
    .badge-success { background: #00d4ff22; color: #00d4ff; }
    .badge-warning { background: #ffaa0022; color: #ffaa00; }
    .badge-error { background: #ff444422; color: #ff4444; }
    .terminal {
      background: #0a0a14;
      border-radius: 8px;
      padding: 1rem;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.875rem;
      overflow-x: auto;
      border: 1px solid #2d2d44;
    }
    .terminal-line {
      padding: 0.25rem 0;
      color: #00ff88;
    }
    .terminal-line.error { color: #ff4444; }
    .terminal-line.warn { color: #ffaa00; }
    .playground {
      background: #1a1a2e;
      border-radius: 12px;
      padding: 1.5rem;
      border: 1px solid #2d2d44;
    }
    .playground h3 {
      color: #00d4ff;
      margin-bottom: 1rem;
    }
    textarea {
      width: 100%;
      min-height: 200px;
      background: #0a0a14;
      border: 1px solid #2d2d44;
      border-radius: 8px;
      padding: 1rem;
      color: #e0e0e0;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.875rem;
      resize: vertical;
    }
    textarea:focus {
      outline: none;
      border-color: #00d4ff;
    }
    .controls {
      display: flex;
      gap: 1rem;
      margin-top: 1rem;
      flex-wrap: wrap;
    }
    select, button {
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      border: 1px solid #2d2d44;
      background: #0f0f23;
      color: #e0e0e0;
      font-size: 0.875rem;
      cursor: pointer;
    }
    button {
      background: linear-gradient(135deg, #00d4ff, #7b2cbf);
      border: none;
      color: #fff;
      font-weight: 600;
    }
    button:hover {
      opacity: 0.9;
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .output {
      margin-top: 1rem;
      padding: 1rem;
      background: #0a0a14;
      border-radius: 8px;
      min-height: 100px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.875rem;
      white-space: pre-wrap;
    }
    .output.success { border-left: 3px solid #00d4ff; }
    .output.error { border-left: 3px solid #ff4444; }
    .status-indicator {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 0.5rem;
    }
    .status-online { background: #00ff88; box-shadow: 0 0 8px #00ff88; }
    .status-busy { background: #ffaa00; box-shadow: 0 0 8px #ffaa00; }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .live-indicator {
      animation: pulse 2s infinite;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>SandboxAI Dashboard</h1>
    <p><span class="status-indicator status-online live-indicator"></span>Live monitoring for secure AI code execution</p>
  </div>

  <div class="container">
    <div class="grid">
      <div class="card">
        <h3>Total Executions</h3>
        <div class="stat-value" id="totalExecs">-</div>
        <div class="stat-label">Code runs since startup</div>
      </div>
      <div class="card">
        <h3>Success Rate</h3>
        <div class="stat-value" id="successRate">-</div>
        <div class="stat-label">Completed successfully</div>
      </div>
      <div class="card">
        <h3>Avg Duration</h3>
        <div class="stat-value" id="avgDuration">-</div>
        <div class="stat-label">Milliseconds per execution</div>
      </div>
      <div class="card">
        <h3>Queue Status</h3>
        <div class="stat-value" id="queueStatus">-</div>
        <div class="stat-label">Running / Queued</div>
      </div>
    </div>

    <div class="card" style="margin-bottom: 2rem;">
      <h3>JavaScript Engines</h3>
      <div class="engine-grid" id="engineGrid">
        <div class="engine-card available">
          <div class="engine-name">V8</div>
          <div class="engine-meta">v12.0 - Google's engine</div>
          <span class="badge badge-success">Available</span>
        </div>
        <div class="engine-card available">
          <div class="engine-name">JavaScriptCore</div>
          <div class="engine-meta">v17.0 - WebKit engine</div>
          <span class="badge badge-success">Available</span>
        </div>
        <div class="engine-card available">
          <div class="engine-name">QuickJS</div>
          <div class="engine-meta">2024-01-13 - Lightweight</div>
          <span class="badge badge-success">Available</span>
        </div>
        <div class="engine-card unavailable">
          <div class="engine-name">SpiderMonkey</div>
          <div class="engine-meta">v115 - Mozilla engine</div>
          <span class="badge badge-warning">Coming Soon</span>
        </div>
      </div>
    </div>

    <div class="playground">
      <h3>Code Playground</h3>
      <textarea id="codeInput" placeholder="// Enter JavaScript code here...
// Example:
const data = [1, 2, 3, 4, 5];
const doubled = data.map(x => x * 2);
console.log('Result:', doubled);
console.log('Sum:', doubled.reduce((a, b) => a + b, 0));">// Enter JavaScript code here...
const data = [1, 2, 3, 4, 5];
const doubled = data.map(x => x * 2);
console.log('Result:', doubled);
console.log('Sum:', doubled.reduce((a, b) => a + b, 0));</textarea>
      <div class="controls">
        <select id="engineSelect">
          <option value="v8">V8 Engine</option>
          <option value="jsc">JavaScriptCore</option>
          <option value="quickjs">QuickJS</option>
        </select>
        <select id="policySelect">
          <option value="standard">Standard Policy</option>
          <option value="strict">Strict Policy</option>
          <option value="extended">Extended Policy</option>
          <option value="agent">AI Agent Policy</option>
        </select>
        <button id="runBtn" onclick="runCode()">Run Code</button>
      </div>
      <div class="output" id="output">Click "Run Code" to execute...</div>
    </div>

    <div class="card" style="margin-top: 2rem;">
      <h3>Recent Executions</h3>
      <div class="terminal" id="recentExecs">
        <div class="terminal-line">Waiting for executions...</div>
      </div>
    </div>
  </div>

  <script>
    let recentExecutions = [];

    async function fetchStats() {
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();

        document.getElementById('totalExecs').textContent = data.totalExecutions || 0;

        const successRate = data.totalExecutions > 0
          ? Math.round((data.successfulExecutions / data.totalExecutions) * 100) + '%'
          : '0%';
        document.getElementById('successRate').textContent = successRate;

        document.getElementById('avgDuration').textContent = (data.averageDurationMs || 0) + 'ms';

        const queue = data.queue || {};
        document.getElementById('queueStatus').textContent =\n          \`\${queue.running || 0} / \${queue.queued || 0}\`;
      } catch (e) {
        console.error('Failed to fetch stats:', e);
      }
    }

    async function runCode() {
      const code = document.getElementById('codeInput').value;
      const engine = document.getElementById('engineSelect').value;
      const policy = document.getElementById('policySelect').value;
      const output = document.getElementById('output');
      const btn = document.getElementById('runBtn');

      btn.disabled = true;
      output.textContent = 'Executing...';
      output.className = 'output';

      try {
        const res = await fetch('/api/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, engine, policy })
        });

        const result = await res.json();

        if (result.status === 'completed') {
          output.textContent = result.output || '(no output)';
          output.className = 'output success';
        } else if (result.status === 'rejected') {
          output.textContent = 'REJECTED: ' + (result.violations || []).join(', ');
          output.className = 'output error';
        } else {
          output.textContent = 'ERROR: ' + (result.error || 'Unknown error');
          output.className = 'output error';
        }

        addRecentExecution(result);
      } catch (e) {
        output.textContent = 'NETWORK ERROR: ' + e.message;
        output.className = 'output error';
      } finally {
        btn.disabled = false;
      }
    }

    function addRecentExecution(result) {
      recentExecutions.unshift({
        id: result.id,
        status: result.status,
        engine: result.engine,
        duration: result.duration_ms,
        time: new Date().toLocaleTimeString()
      });

      if (recentExecutions.length > 10) {
        recentExecutions = recentExecutions.slice(0, 10);
      }

      updateRecentDisplay();
    }

    function updateRecentDisplay() {
      const container = document.getElementById('recentExecs');
      if (recentExecutions.length === 0) return;

      container.innerHTML = recentExecutions.map(exec => {
        const statusColor = exec.status === 'completed' ? '#00ff88' :
                           exec.status === 'rejected' ? '#ffaa00' : '#ff4444';
        return \`<div class="terminal-line" style="color: \${statusColor}">
          [\${exec.time}] \${exec.id} | \${exec.engine} | \${exec.status} | \${exec.duration}ms
        </div>\`;
      }).join('');
    }

    // Poll stats every 2 seconds
    fetchStats();
    setInterval(fetchStats, 2000);
  </script>
</body>
</html>`;
  }
}

module.exports = { Dashboard };
