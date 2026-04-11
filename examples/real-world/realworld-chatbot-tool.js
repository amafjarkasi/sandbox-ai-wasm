/**
 * Real-World Example: AI Chatbot Tool Execution
 * 
 * Execute tools safely for LLM agents
 */

class ChatbotToolExecutor {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'http://localhost:3000';
  }

  async executeTool(toolName, args) {
    const tools = {
      calculate: \`
        const args = JSON.parse(process.env.TOOL_ARGS);
        let result;
        
        switch (args.operation) {
          case 'add':
            result = args.a + args.b;
            break;
          case 'subtract':
            result = args.a - args.b;
            break;
          case 'multiply':
            result = args.a * args.b;
            break;
          case 'divide':
            if (args.b === 0) throw new Error('Division by zero');
            result = args.a / args.b;
            break;
          case 'compound_interest':
            result = args.principal * Math.pow(1 + args.rate, args.years);
            break;
          default:
            throw new Error(\`Unknown operation: \${args.operation}\`);
        }
        
        console.log(JSON.stringify({
          operation: args.operation,
          inputs: args,
          result: Number(result.toFixed(2))
        }));
      \\\`,
      
      get_weather: \`
        const args = JSON.parse(process.env.TOOL_ARGS);
        
        // Simulate weather API call
        const weatherData = {
          location: args.location,
          temperature: 72,
          unit: args.unit || 'fahrenheit',
          condition: 'sunny',
          humidity: 45,
          forecast: [
            { day: 'Today', high: 75, low: 65, condition: 'sunny' },
            { day: 'Tomorrow', high: 73, low: 62, condition: 'partly cloudy' }
          ]
        };
        
        console.log(JSON.stringify(weatherData));
      \\\`,
      
      search_products: \`
        const args = JSON.parse(process.env.TOOL_ARGS);
        
        // Simulate product search
        const products = [
          { id: 1, name: 'Wireless Headphones', price: 99.99, category: 'electronics' },
          { id: 2, name: 'USB-C Cable', price: 15.99, category: 'electronics' },
          { id: 3, name: 'Notebook', price: 12.50, category: 'office' }
        ].filter(p => 
          p.name.toLowerCase().includes(args.query.toLowerCase()) ||
          p.category.toLowerCase().includes(args.query.toLowerCase())
        );
        
        console.log(JSON.stringify({
          query: args.query,
          results: products,
          count: products.length
        }));
      \\\`,
      
      validate_email: \`
        const args = JSON.parse(process.env.TOOL_ARGS);
        const email = args.email;
        
        const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
        const isValid = emailRegex.test(email);
        
        const domain = email.split('@')[1];
        const commonDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
        
        console.log(JSON.stringify({
          email: email,
          isValid: isValid,
          domain: domain,
          isCommonDomain: commonDomains.includes(domain),
          suggestions: isValid ? [] : ['Check for typos', 'Ensure @ symbol is present']
        }));
      \\\
    };

    const code = tools[toolName];
    if (!code) {
      throw new Error(\`Unknown tool: \${toolName}\`);
    }

    const response = await fetch(\`\${this.baseUrl}/mcp/tools/execute\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${this.apiKey}\`
      },
      body: JSON.stringify({
        code,
        context: { TOOL_ARGS: JSON.stringify(args) },
        policy: {
          timeout: 5000,
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
}

// Example usage
const executor = new ChatbotToolExecutor('your-api-key');

async function chatbotExample() {
  // Tool 1: Calculate compound interest
  console.log('Tool: calculate (compound_interest)');
  const interest = await executor.executeTool('calculate', {
    operation: 'compound_interest',
    principal: 10000,
    rate: 0.07,
    years: 10
  });
  console.log(\`Investment result: \$\${interest.result}\`);

  // Tool 2: Get weather
  console.log('\nTool: get_weather');
  const weather = await executor.executeTool('get_weather', {
    location: 'San Francisco, CA',
    unit: 'fahrenheit'
  });
  console.log(\`Weather in \${weather.location}: \${weather.temperature}°\${weather.unit === 'fahrenheit' ? 'F' : 'C'}, \${weather.condition}\`);

  // Tool 3: Search products
  console.log('\nTool: search_products');
  const products = await executor.executeTool('search_products', {
    query: 'electronics'
  });
  console.log(\`Found \${products.count} products:\`);
  products.results.forEach(p => console.log(\`  - \${p.name}: \$\${p.price}\`));

  // Tool 4: Validate email
  console.log('\nTool: validate_email');
  const validation = await executor.executeTool('validate_email', {
    email: 'user@example.com'
  });
  console.log(\`Email \${validation.email} is \${validation.isValid ? 'valid' : 'invalid'}\`);
}

chatbotExample().catch(console.error);
