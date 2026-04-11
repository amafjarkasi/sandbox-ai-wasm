/**
 * Real-World Example: File Format Converter
 * 
 * Convert between JSON, YAML, CSV, and other formats
 */

async function convertFormat(inputData, fromFormat, toFormat) {
  const converters = {
    'json-to-yaml': `
      const yaml = require('js-yaml');
      const json = JSON.parse(process.env.INPUT_DATA);
      console.log(yaml.dump(json));
    `,
    'yaml-to-json': `
      const yaml = require('js-yaml');
      const obj = yaml.load(process.env.INPUT_DATA);
      console.log(JSON.stringify(obj, null, 2));
    `,
    'json-to-csv': `
      const data = JSON.parse(process.env.INPUT_DATA);
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('JSON must be an array of objects');
      }
      
      const headers = Object.keys(data[0]);
      const csv = [
        headers.join(','),
        ...data.map(row => headers.map(h => JSON.stringify(row[h] || '')).join(','))
      ].join('\\n');
      
      console.log(csv);
    `,
    'csv-to-json': `
      const lines = process.env.INPUT_DATA.split('\\n').filter(l => l.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      
      const json = lines.slice(1).map(line => {
        const values = line.split(',');
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = values[i]?.trim() || '';
        });
        return obj;
      });
      
      console.log(JSON.stringify(json, null, 2));
    `
  };

  const converterKey = \`\${fromFormat}-to-\${toFormat}\`;
  const code = converters[converterKey];
  
  if (!code) {
    throw new Error(\`Unsupported conversion: \${fromFormat} to \${toFormat}\`);
  }

  const response = await fetch('http://localhost:3000/api/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer your-api-key'
    },
    body: JSON.stringify({
      code,
      context: { INPUT_DATA: inputData },
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
    return result.output;
  } else {
    throw new Error(result.error);
  }
}

// Example 1: JSON to YAML
const jsonData = JSON.stringify({
  name: 'MyApp',
  version: '1.0.0',
  dependencies: {
    express: '^4.18.0',
    lodash: '^4.17.0'
  }
}, null, 2);

convertFormat(jsonData, 'json', 'yaml')
  .then(yaml => {
    console.log('JSON to YAML:');
    console.log(yaml);
  });

// Example 2: CSV to JSON
const csvData = \`id,name,email
1,John Doe,john@example.com
2,Jane Smith,jane@example.com
3,Bob Wilson,bob@example.com\`;

convertFormat(csvData, 'csv', 'json')
  .then(json => {
    console.log('\nCSV to JSON:');
    console.log(json);
  });

// Example 3: Array to CSV
const arrayData = JSON.stringify([
  { product: 'Laptop', price: 999.99, stock: 15 },
  { product: 'Mouse', price: 29.99, stock: 150 },
  { product: 'Keyboard', price: 79.99, stock: 75 }
]);

convertFormat(arrayData, 'json', 'csv')
  .then(csv => {
    console.log('\nArray to CSV:');
    console.log(csv);
  });
