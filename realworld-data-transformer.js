/**
 * Real-World Example: Data Transformation Pipeline
 * 
 * Transform CSV to JSON in a secure sandbox with readonly filesystem
 */

async function transformData(csvContent) {
  const code = `
    // Parse CSV content
    const lines = process.env.CSV_DATA.split('\\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const results = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',');
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim();
      });
      results.push(row);
    }
    
    console.log(JSON.stringify(results, null, 2));
  `;

  const response = await fetch('http://localhost:3000/api/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer your-api-key'
    },
    body: JSON.stringify({
      code,
      context: { CSV_DATA: csvContent },
      policy: {
        filesystem: 'readonly',
        network: 'none',
        timeout: 5000
      }
    })
  });

  return await response.json();
}

// Example usage
const sampleCSV = `name,email,role
John Doe,john@example.com,admin
Jane Smith,jane@example.com,user
Bob Wilson,bob@example.com,editor`;

transformData(sampleCSV)
  .then(result => {
    console.log('Transformed data:');
    console.log(result.output);
  })
  .catch(err => console.error('Transform failed:', err));
