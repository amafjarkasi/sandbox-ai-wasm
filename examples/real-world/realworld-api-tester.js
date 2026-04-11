/**
 * Real-World Example: API Integration Testing
 * 
 * Test third-party APIs in an isolated environment
 */

async function testAPI(endpoint, options = {}) {
  const code = `
    const endpoint = process.env.API_ENDPOINT;
    const options = JSON.parse(process.env.API_OPTIONS);
    
    async function runTest() {
      const startTime = Date.now();
      
      try {
        const response = await fetch(endpoint, {
          method: options.method || 'GET',
          headers: options.headers || {},
          body: options.body ? JSON.stringify(options.body) : undefined
        });
        
        const latency = Date.now() - startTime;
        const data = await response.json().catch(() => null);
        
        const result = {
          success: response.ok,
          status: response.status,
          statusText: response.statusText,
          latency: latency,
          headers: Object.fromEntries(response.headers.entries()),
          data: data,
          timestamp: new Date().toISOString()
        };
        
        // Validate response if schema provided
        if (options.expectedSchema && data) {
          const missing = options.expectedSchema.filter(key => !(key in data));
          if (missing.length > 0) {
            result.schemaValid = false;
            result.missingFields = missing;
          } else {
            result.schemaValid = true;
          }
        }
        
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        console.log(JSON.stringify({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        }));
      }
    }
    
    runTest();
  `;

  const response = await fetch('http://localhost:3000/api/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer your-api-key'
    },
    body: JSON.stringify({
      code,
      context: {
        API_ENDPOINT: endpoint,
        API_OPTIONS: JSON.stringify(options)
      },
      policy: {
        timeout: 10000,
        memory: '64mb',
        network: 'outbound',
        filesystem: 'none'
      }
    })
  });

  const result = await response.json();
  
  if (result.status === 'completed') {
    return JSON.parse(result.output);
  } else {
    throw new Error(result.error);
  }
}

// Example: Test a REST API
async function runTests() {
  // Test 1: Health check
  console.log('Test 1: Health Check');
  const health = await testAPI('https://api.github.com/status', {
    expectedSchema: ['status', 'message']
  });
  console.log('Health check result:', health.success ? '✅ PASS' : '❌ FAIL');
  
  // Test 2: API with headers
  console.log('\nTest 2: API with Authentication');
  const apiResult = await testAPI('https://api.github.com/user', {
    headers: {
      'Authorization': 'token ghp_your_token',
      'User-Agent': 'SandboxAI-Tester'
    },
    expectedSchema: ['login', 'id', 'type']
  });
  console.log('API test result:', apiResult.success ? '✅ PASS' : '❌ FAIL');
  if (apiResult.schemaValid !== undefined) {
    console.log('Schema validation:', apiResult.schemaValid ? '✅ VALID' : '❌ INVALID');
  }
  
  // Test 3: POST request
  console.log('\nTest 3: POST Request');
  const postResult = await testAPI('https://httpbin.org/post', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { test: 'data', timestamp: Date.now() }
  });
  console.log('POST test result:', postResult.success ? '✅ PASS' : '❌ FAIL');
}

runTests().catch(console.error);
