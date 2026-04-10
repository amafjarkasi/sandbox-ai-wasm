/**
 * Real-World Example: Educational Code Runner
 * 
 * Run student code safely for coding exercises
 */

class CodeRunner {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'http://localhost:3000';
  }

  async runStudentCode(code, testCases) {
    const executionCode = \`
      const studentCode = process.env.STUDENT_CODE;
      const testCases = JSON.parse(process.env.TEST_CASES);
      
      // Create a safe environment for student code
      const results = [];
      
      for (const test of testCases) {
        try {
          // Wrap student code in a function
          const wrappedCode = \`
            \${studentCode}
            
            // Run the function with test input
            const result = \${test.functionName}(...\${JSON.stringify(test.inputs)});
            console.log(JSON.stringify({
              testId: \${test.id},
              passed: JSON.stringify(result) === JSON.stringify(\${JSON.stringify(test.expected)}),
              actual: result,
              expected: \${JSON.stringify(test.expected)}
            }));
          \`;
          
          eval(wrappedCode);
        } catch (error) {
          console.log(JSON.stringify({
            testId: test.id,
            passed: false,
            error: error.message
          }));
        }
      }
    \`;

    const response = await fetch(\`\${this.baseUrl}/api/execute\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${this.apiKey}\`
      },
      body: JSON.stringify({
        code: executionCode,
        context: {
          STUDENT_CODE: code,
          TEST_CASES: JSON.stringify(testCases)
        },
        policy: {
          timeout: 5000,
          memory: '64mb',
          network: 'none',
          filesystem: 'none'
        }
      })
    });

    const result = await response.json();
    
    if (result.status === 'completed') {
      // Parse individual test results from output
      const lines = result.output.trim().split('\\n');
      return lines.map(line => JSON.parse(line));
    } else {
      return [{ passed: false, error: result.error }];
    }
  }

  async analyzeCode(code) {
    const response = await fetch(\`\${this.baseUrl}/api/analyze\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${this.apiKey}\`
      },
      body: JSON.stringify({ code })
    });

    return await response.json();
  }
}

// Example: Run coding exercise
async function runExercise() {
  const runner = new CodeRunner('your-api-key');
  
  // Exercise: Write a function to calculate factorial
  const studentCode = \`
    function factorial(n) {
      if (n <= 1) return 1;
      return n * factorial(n - 1);
    }
  \`;
  
  const testCases = [
    { id: 1, functionName: 'factorial', inputs: [0], expected: 1 },
    { id: 2, functionName: 'factorial', inputs: [1], expected: 1 },
    { id: 3, functionName: 'factorial', inputs: [5], expected: 120 },
    { id: 4, functionName: 'factorial', inputs: [10], expected: 3628800 }
  ];
  
  console.log('Running student code...');
  const results = await runner.runStudentCode(studentCode, testCases);
  
  console.log('\nTest Results:');
  let passedCount = 0;
  results.forEach(result => {
    if (result.passed) {
      console.log(\`  ✅ Test \${result.testId}: PASSED\`);
      passedCount++;
    } else if (result.error) {
      console.log(\`  ❌ Test \${result.testId}: ERROR - \${result.error}\`);
    } else {
      console.log(\`  ❌ Test \${result.testId}: FAILED\`);
      console.log(\`     Expected: \${JSON.stringify(result.expected)}\`);
      console.log(\`     Actual: \${JSON.stringify(result.actual)}\`);
    }
  });
  
  console.log(\`\\nScore: \${passedCount}/\${testCases.length} tests passed\`);
  
  // Security analysis
  console.log('\nSecurity Analysis:');
  const analysis = await runner.analyzeCode(studentCode);
  if (analysis.analysis.isDangerous) {
    console.log('  ⚠️  Security issues found:');
    analysis.analysis.findings.forEach(f => {
      console.log(\`     - [\${f.severity}] \${f.description}\`);
    });
  } else {
    console.log('  ✅ No security issues detected');
  }
}

// Example: Run with malicious code (should be blocked)
async function testMaliciousCode() {
  const runner = new CodeRunner('your-api-key');
  
  const maliciousCode = \`
    function factorial(n) {
      // Attempt to access filesystem
      const fs = require('fs');
      fs.readFileSync('/etc/passwd');
      return n <= 1 ? 1 : n * factorial(n - 1);
    }
  \`;
  
  console.log('\nTesting malicious code detection...');
  const analysis = await runner.analyzeCode(maliciousCode);
  
  if (analysis.analysis.isDangerous) {
    console.log('  ✅ Malicious code detected and blocked!');
    console.log(\`  Risk Score: \${analysis.analysis.riskScore}/100\`);
    analysis.analysis.findings.forEach(f => {
      console.log(\`  - [\${f.severity.toUpperCase()}] \${f.category}: \${f.description}\`);
    });
  }
}

runExercise().then(() => testMaliciousCode()).catch(console.error);
