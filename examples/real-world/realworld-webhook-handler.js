/**
 * Real-World Example: Webhook Handler
 * 
 * Process incoming webhooks safely with validation
 */

async function processWebhook(webhookPayload) {
  const code = `
    const payload = JSON.parse(process.env.WEBHOOK_PAYLOAD);
    
    // Validate webhook signature (simplified)
    const crypto = require('crypto');
    const secret = process.env.WEBHOOK_SECRET;
    
    // Process based on event type
    switch (payload.event) {
      case 'payment.success':
        const paymentData = {
          orderId: payload.data.order_id,
          amount: payload.data.amount,
          currency: payload.data.currency,
          customerEmail: payload.data.customer_email,
          timestamp: new Date().toISOString(),
          status: 'processed'
        };
        console.log(JSON.stringify({
          type: 'payment',
          action: 'record_transaction',
          data: paymentData
        }));
        break;
        
      case 'user.signup':
        const userData = {
          userId: payload.data.user_id,
          email: payload.data.email,
          plan: payload.data.subscription_plan,
          createdAt: new Date().toISOString()
        };
        console.log(JSON.stringify({
          type: 'user',
          action: 'create_account',
          data: userData
        }));
        break;
        
      default:
        console.log(JSON.stringify({
          type: 'unknown',
          event: payload.event,
          action: 'log_only'
        }));
    }
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
        WEBHOOK_PAYLOAD: JSON.stringify(webhookPayload),
        WEBHOOK_SECRET: 'your-webhook-secret'
      },
      policy: {
        timeout: 3000,
        memory: '64mb',
        network: 'none',
        filesystem: 'none',
        modules: ['node:crypto']
      }
    })
  });

  return await response.json();
}

// Example: Payment success webhook
const paymentWebhook = {
  event: 'payment.success',
  data: {
    order_id: 'ORD-12345',
    amount: 99.99,
    currency: 'USD',
    customer_email: 'customer@example.com'
  }
};

processWebhook(paymentWebhook)
  .then(result => {
    if (result.status === 'completed') {
      const output = JSON.parse(result.output);
      console.log('Webhook processed:', output);
    } else {
      console.error('Webhook failed:', result.error);
    }
  });

// Example: User signup webhook
const signupWebhook = {
  event: 'user.signup',
  data: {
    user_id: 'USR-67890',
    email: 'newuser@example.com',
    subscription_plan: 'premium'
  }
};

processWebhook(signupWebhook)
  .then(result => console.log('Signup processed:', result.output));
