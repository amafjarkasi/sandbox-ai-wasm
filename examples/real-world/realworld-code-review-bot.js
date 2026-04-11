/**
 * Real-World Example: Code Review Bot
 * 
 * Automatically analyze code for security issues before merging PRs
 */

async function reviewCode(codeSnippet) {
  const response = await fetch('http://localhost:3000/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer your-api-key'
    },
    body: JSON.stringify({ code: codeSnippet })
  });

  const result = await response.json();
  
  if (result.analysis.isDangerous) {
    console.log('❌ Security issues found:');
    result.analysis.findings.forEach(finding => {
      console.log(`  - [${finding.severity.toUpperCase()}] ${finding.category}: ${finding.description}`);
    });
    return { approved: false, findings: result.analysis.findings };
  }
  
  console.log('✅ Code passed security review');
  return { approved: true };
}

// Example: Review a suspicious code snippet
const suspiciousCode = `
function processUserInput(input) {
  return eval(input);  // Dangerous - allows arbitrary code execution!
}
`;

reviewCode(suspiciousCode).then(console.log);

// Example: Review safe code
const safeCode = `
function calculateSum(a, b) {
  return a + b;
}
`;

reviewCode(safeCode).then(console.log);
