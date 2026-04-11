/**
 * SandboxAI Example: Data Pipeline
 * Demonstrates streaming execution for long-running tasks
 */

const http = require("node:http");

const pipelineCode = `
// Simulate a data processing pipeline
const steps = [
  "Loading raw data...",
  "Cleaning data...",
  "Normalizing values...",
  "Running analysis...",
  "Generating report..."
];

async function runPipeline() {
  for (let i = 0; i < steps.length; i++) {
    console.log(\`[Step \${i + 1}/\${steps.length}] \${steps[i]}\`);
    
    // Simulate work
    await new Promise(r => setTimeout(r, 800));
    
    // Progress update
    const progress = Math.round(((i + 1) / steps.length) * 100);
    console.log(\`Progress: \${progress}%\`);
    
    // Simulate some data output
    if (i === 2) {
      console.log("  - Normalized 1,247 records");
    }
    if (i === 3) {
      console.log("  - Found 23 anomalies");
      console.log("  - Computed statistics");
    }
  }
  
  console.log("\\nPipeline complete!");
  console.log("Results: { processed: 1247, anomalies: 23, duration: '4s' }");
}

runPipeline();
`;

console.log("=== SandboxAI Data Pipeline Example ===\\n");
console.log("Starting streaming execution...\\n");

const req = http.request({
  hostname: "localhost",
  port: 3000,
  path: "/api/execute/stream",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Accept": "text/event-stream"
  }
}, (res) => {
  res.on("data", (chunk) => {
    const lines = chunk.toString().split("\\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === "stdout") {
            process.stdout.write(data.data);
          } else if (data.type === "stderr") {
            process.stderr.write(data.data);
          } else if (data.type === "complete") {
            console.log("\\n=== Execution Complete ===");
            console.log("Status:", data.status);
            console.log("Duration:", data.duration_ms, "ms");
            console.log("Engine:", data.engine);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  });

  res.on("end", () => {
    console.log("\\nStream closed.");
  });
});

req.write(JSON.stringify({
  code: pipelineCode,
  engine: "v8",
  policy: "extended",
  timeout: 30000
}));

req.end();
