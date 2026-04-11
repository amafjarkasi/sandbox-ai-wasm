/**
 * SandboxAI Example: Quick Run
 * Demonstrates basic code execution
 */

const http = require("node:http");

const code = `
// Quick computation example
const start = Date.now();

// Calculate fibonacci
function fib(n) {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}

console.log("Fibonacci(35):", fib(35));
console.log("Duration:", Date.now() - start, "ms");
`;

console.log("=== SandboxAI Quick Run Example ===\n");
console.log("Executing code:\n" + code);

const req = http.request({
  hostname: "localhost",
  port: 3000,
  path: "/api/execute",
  method: "POST",
  headers: { "Content-Type": "application/json" }
}, (res) => {
  let data = "";
  res.on("data", chunk => data += chunk);
  res.on("end", () => {
    const result = JSON.parse(data);
    console.log("\n=== Result ===");
    console.log("Status:", result.status);
    console.log("Duration:", result.duration_ms, "ms");
    console.log("Engine:", result.engine);
    console.log("\nOutput:");
    console.log(result.output);
  });
});

req.write(JSON.stringify({
  code,
  engine: "v8",
  policy: "standard"
}));

req.end();
