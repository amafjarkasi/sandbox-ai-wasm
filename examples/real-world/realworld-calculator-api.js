/**
 * Real-World Example: Safe Calculator API
 * 
 * Evaluate math expressions safely without using eval()
 */

async function calculate(expression) {
  const code = `
    const expression = process.env.MATH_EXPRESSION;
    
    // Whitelist allowed operators and functions
    const allowedPattern = /^[0-9+\-*/().\s]+$/;
    
    if (!allowedPattern.test(expression)) {
      throw new Error('Invalid characters in expression');
    }
    
    // Safe evaluation in isolated sandbox
    const result = eval(expression);
    console.log(JSON.stringify({ expression, result }));
  `;

  const response = await fetch('http://localhost:3000/api/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer your-api-key'
    },
    body: JSON.stringify({
      code,
      context: { MATH_EXPRESSION: expression },
      policy: {
        timeout: 1000,
        memory: '32mb',
        network: 'none',
        filesystem: 'none'
      }
    })
  });

  const result = await response.json();
  
  if (result.status === 'completed') {
    const output = JSON.parse(result.output);
    return output.result;
  } else {
    throw new Error(result.error || 'Calculation failed');
  }
}

// Example calculations
async function runExamples() {
  try {
    console.log('2 + 2 =', await calculate('2 + 2'));
    console.log('10 * 5 =', await calculate('10 * 5'));
    console.log('(3 + 4) * 2 =', await calculate('(3 + 4) * 2'));
    console.log('2 ** 10 =', await calculate('2 ** 10'));
    
    // This will fail safely
    try {
      await calculate('process.exit(1)');
    } catch (e) {
      console.log('Malicious code blocked:', e.message);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

runExamples();
