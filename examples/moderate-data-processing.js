/**
 * SandboxAI Example: Moderate - Data Processing Pipeline
 * Demonstrates CSV parsing, data transformation, and aggregation
 */

const http = require("node:http");

// Sample CSV data
const csvData = `
name,age,city,salary,department
Alice,29,New York,85000,Engineering
Bob,34,San Francisco,92000,Engineering
Carol,31,New York,78000,Marketing
David,45,Chicago,110000,Engineering
Eve,28,San Francisco,75000,Marketing
Frank,52,New York,125000,Engineering
Grace,36,Chicago,88000,Sales
Henry,41,San Francisco,95000,Sales
Ivy,33,New York,82000,Engineering
Jack,29,Chicago,71000,Marketing
`;

const dataProcessingCode = `
// CSV Parser and Data Analysis Pipeline
const csvData = \`${csvData}\`;

// Parse CSV
function parseCSV(csv) {
  const lines = csv.trim().split('\\n');
  const headers = lines[0].split(',');
  
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i]);
    return obj;
  });
}

// Data transformations
const data = parseCSV(csvData);

// 1. Calculate department statistics
const deptStats = data.reduce((acc, row) => {
  const dept = row.department;
  if (!acc[dept]) {
    acc[dept] = { count: 0, totalSalary: 0, ages: [] };
  }
  acc[dept].count++;
  acc[dept].totalSalary += parseInt(row.salary);
  acc[dept].ages.push(parseInt(row.age));
  return acc;
}, {});

// Calculate averages
for (const dept in deptStats) {
  const stats = deptStats[dept];
  stats.avgSalary = Math.round(stats.totalSalary / stats.count);
  stats.avgAge = Math.round(stats.ages.reduce((a,b) => a+b, 0) / stats.count);
}

// 2. City distribution
const cityDist = data.reduce((acc, row) => {
  acc[row.city] = (acc[row.city] || 0) + 1;
  return acc;
}, {});

// 3. Salary percentiles
const salaries = data.map(r => parseInt(r.salary)).sort((a,b) => a-b);
const p50 = salaries[Math.floor(salaries.length * 0.5)];
const p75 = salaries[Math.floor(salaries.length * 0.75)];
const p90 = salaries[Math.floor(salaries.length * 0.9)];

// 4. High earners by city
const highEarners = data
  .filter(r => parseInt(r.salary) > p75)
  .reduce((acc, r) => {
    if (!acc[r.city]) acc[r.city] = [];
    acc[r.city].push({ name: r.name, salary: parseInt(r.salary) });
    return acc;
  }, {});

// Output results
console.log("=== Department Statistics ===");
console.log(JSON.stringify(deptStats, null, 2));

console.log("\\n=== City Distribution ===");
console.log(JSON.stringify(cityDist, null, 2));

console.log("\\n=== Salary Percentiles ===");
console.log({ p50, p75, p90 });

console.log("\\n=== High Earners by City ===");
console.log(JSON.stringify(highEarners, null, 2));

// 5. Correlation analysis (age vs salary)
const n = data.length;
const sumX = data.reduce((s, r) => s + parseInt(r.age), 0);
const sumY = data.reduce((s, r) => s + parseInt(r.salary), 0);
const sumXY = data.reduce((s, r) => s + parseInt(r.age) * parseInt(r.salary), 0);
const sumX2 = data.reduce((s, r) => s + parseInt(r.age) ** 2, 0);
const sumY2 = data.reduce((s, r) => s + parseInt(r.salary) ** 2, 0);

const correlation = (n * sumXY - sumX * sumY) / 
  Math.sqrt((n * sumX2 - sumX**2) * (n * sumY2 - sumY**2));

console.log("\\n=== Age-Salary Correlation ===");
console.log({ correlation: correlation.toFixed(4), interpretation: correlation > 0.3 ? "Positive" : "Weak" });
`;

async function runExample() {
  console.log("=== SandboxAI: Data Processing Pipeline ===\\n");

  return new Promise((resolve, reject) => {
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
        console.log("Execution Result:");
        console.log("  Status:", result.status);
        console.log("  Duration:", result.duration_ms, "ms");
        console.log("  Risk Level:", result.dangerAnalysis?.riskLevel || "N/A");
        console.log("\\nOutput:");
        console.log(result.output);
        resolve(result);
      });
    });

    req.on("error", reject);

    req.write(JSON.stringify({
      code: dataProcessingCode,
      engine: "v8",
      policy: "standard",
      context: "Data processing pipeline example"
    }));

    req.end();
  });
}

// Check server
http.get("http://localhost:3000/api/stats", (res) => {
  runExample().catch(console.error);
}).on("error", () => {
  console.error("❌ Server not running. Start with: node server.js");
});
