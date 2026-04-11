/**
 * SandboxAI Example: AI Agent Integration
 * Demonstrates MCP tool usage for AI agents
 */

const http = require("node:http");

const scenarios = [
  {
    name: "Data Processing",
    code: `
// Process JSON data
const data = [
  { name: "Alice", score: 85 },
  { name: "Bob", score: 92 },
  { name: "Carol", score: 78 }
];

const avg = data.reduce((sum, d) => sum + d.score, 0) / data.length;
const top = data.filter(d => d.score > avg);

console.log("Average score:", avg.toFixed(2));
console.log("Top performers:", top.map(d => d.name).join(", "));
`
  },
  {
    name: "API Simulation",
    code: `
// Simulate API response processing
const users = Array.from({ length: 5 }, (_, i) => ({
  id: i + 1,
  name: \`User_\${i + 1}\`,
  active: Math.random() > 0.3
}));

const activeUsers = users.filter(u => u.active);
console.log("Total users:", users.length);
console.log("Active users:", activeUsers.length);
console.log("Active:", activeUsers.map(u => u.name).join(", "));
`
  },
  {
    name: "Algorithm Test",
    code: `
// Quick sort implementation
function quickSort(arr) {
  if (arr.length <= 1) return arr;
  const pivot = arr[Math.floor(arr.length / 2)];
  const left = arr.filter(x => x < pivot);
  const middle = arr.filter(x => x === pivot);
  const right = arr.filter(x => x > pivot);
  return [...quickSort(left), ...middle, ...quickSort(right)];
}

const unsorted = [64, 34, 25, 12, 22, 11, 90];
console.log("Unsorted:", unsorted);
console.log("Sorted:", quickSort(unsorted));
`
  }
];

async function runScenario(scenario) {
  return new Promise((resolve, reject) => {
    console.log(`\\n--- Running: ${scenario.name} ---`);

    const req = http.request({
      hostname: "localhost",
      port: 3000,
      path: "/mcp/tools/execute",
      method: "POST",
      headers: { "Content-Type": "application/json" }
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        const result = JSON.parse(data);
        console.log("Result:", result.result?.status || result.error);
        if (result.result?.output) {
          console.log("Output:", result.result.output);
        }
        resolve(result);
      });
    });

    req.on("error", reject);

    req.write(JSON.stringify({
      code: scenario.code,
      engine: "v8",
      policy: "agent",
      context: `AI agent executing: ${scenario.name}`
    }));

    req.end();
  });
}

async function main() {
  console.log("=== SandboxAI AI Agent Example ===");
  console.log("Simulating AI agent using MCP tools...");

  for (const scenario of scenarios) {
    await runScenario(scenario);
  }

  console.log("\\n=== All scenarios completed ===");
}

main().catch(console.error);
