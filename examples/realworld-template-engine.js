/**
 * Real-World Example: Template Engine
 * 
 * Render templates safely with variable substitution
 */

async function renderTemplate(template, data) {
  const code = `
    const template = process.env.TEMPLATE_STRING;
    const data = JSON.parse(process.env.TEMPLATE_DATA);
    
    // Simple template engine with variable substitution
    function render(template, context) {
      return template.replace(/\\{\\{(\\w+)\\}\\}/g, (match, key) => {
        return context[key] !== undefined ? context[key] : match;
      });
    }
    
    // Sanitize output to prevent XSS
    function sanitize(str) {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    }
    
    const rendered = render(template, data);
    const safeOutput = sanitize(rendered);
    
    console.log(JSON.stringify({
      original: template,
      rendered: safeOutput,
      variables: Object.keys(data)
    }));
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
        TEMPLATE_STRING: template,
        TEMPLATE_DATA: JSON.stringify(data)
      },
      policy: {
        timeout: 2000,
        memory: '32mb',
        network: 'none',
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

// Example: Email template
const emailTemplate = `
Hello {{name}},

Welcome to {{company}}! Your account has been created.

Your plan: {{plan}}
Account ID: {{accountId}}

Best regards,
The {{company}} Team
`;

const userData = {
  name: 'John Doe',
  company: 'Acme Corp',
  plan: 'Premium',
  accountId: 'ACC-12345'
};

renderTemplate(emailTemplate, userData)
  .then(result => {
    console.log('Rendered email:');
    console.log(result.rendered);
  })
  .catch(err => console.error('Template error:', err));

// Example: HTML template with XSS protection
const htmlTemplate = '<h1>Hello {{name}}</h1><p>Your balance: ${{balance}}</p>';
const maliciousData = {
  name: '<script>alert("xss")</script>',
  balance: '100.00'
};

renderTemplate(htmlTemplate, maliciousData)
  .then(result => {
    console.log('\nXSS-protected output:');
    console.log(result.rendered);
  });
