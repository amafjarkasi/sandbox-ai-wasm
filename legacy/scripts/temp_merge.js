const fs = require('fs');

const original = fs.readFileSync('lib/dashboard.js', 'utf8');
const newHtml = fs.readFileSync('new_dashboard.html', 'utf8');

const scriptStartIdx = original.indexOf('<script>');
const scriptEndIdx = original.indexOf('</script>', scriptStartIdx) + 9;
const originalScript = original.substring(scriptStartIdx, scriptEndIdx);

const bodyEndIdx = newHtml.indexOf('</body>');
const modifiedHtml = newHtml.substring(0, bodyEndIdx) + "\n" + originalScript + "\n" + newHtml.substring(bodyEndIdx);

const finalFile = `/**
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
    return ${JSON.stringify(modifiedHtml)};
  }
}

module.exports = { Dashboard };
`;

fs.writeFileSync('lib/dashboard.js', finalFile);
console.log('Successfully updated lib/dashboard.js');
