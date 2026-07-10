const baseUrl = 'http://localhost:8080';

async function runTests() {
  console.log('🚀 Starting integration tests...\n');

  try {
    // 1. Health check
    console.log('Testing GET /health...');
    const healthRes = await fetch(`${baseUrl}/health`);
    const health = await healthRes.json();
    console.log('Health Response status:', healthRes.status, health);
    if (healthRes.status !== 200 || health.status !== 'ok' || health.db !== 'healthy') {
      throw new Error('Health check failed');
    }
    console.log('✅ Health check passed\n');

    // 2. Fetch products
    console.log('Testing GET /api/products...');
    const prodRes = await fetch(`${baseUrl}/api/products`);
    const products = await prodRes.json();
    console.log(`Retrieved ${products.length} products:`);
    console.table(products);

    const laptop = products.find(p => p.id === 1);
    const headphones = products.find(p => p.id === 3);

    if (!laptop || laptop.stock !== 10) {
      throw new Error('Laptop stock should be 10 initially');
    }
    if (!headphones || headphones.stock !== 0) {
      throw new Error('Headphones stock should be 0 initially');
    }
    console.log('✅ Catalog validation passed\n');

    // 3. Create a valid order
    console.log('Testing POST /api/orders (Successful order)...');
    const orderPayload = {
      userId: 1,
      items: [
        { productId: 1, quantity: 2 } // Order 2 Laptops
      ]
    };
    const createRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });
    const orderResult = await createRes.json();
    console.log('Create Order Response:', createRes.status, orderResult);
    if (createRes.status !== 201 || !orderResult.orderId || orderResult.status !== 'processing') {
      throw new Error('Order creation failed');
    }
    const orderId = orderResult.orderId;
    console.log('✅ Order creation succeeded\n');

    // 4. Retrieve order details
    console.log(`Testing GET /api/orders/${orderId}...`);
    const detailsRes = await fetch(`${baseUrl}/api/orders/${orderId}`);
    const details = await detailsRes.json();
    console.log('Order Details:', JSON.stringify(details, null, 2));
    if (detailsRes.status !== 200 || details.user.id !== 1 || details.items[0].quantity !== 2) {
      throw new Error('Failed to retrieve correct order details');
    }
    console.log('✅ Order details retrieval passed\n');

    // 5. Verify stock decreased
    console.log('Verifying stock decrement...');
    const prodRes2 = await fetch(`${baseUrl}/api/products`);
    const products2 = await prodRes2.json();
    const laptop2 = products2.find(p => p.id === 1);
    console.log(`Laptop stock after order: ${laptop2.stock} (expected: 8)`);
    if (laptop2.stock !== 8) {
      throw new Error('Product stock was not correctly decremented');
    }
    console.log('✅ Stock decrement passed\n');

    // 6. Test rollback on insufficient stock
    console.log('Testing POST /api/orders (Failure & Rollback - Out of Stock)...');
    const failedPayload = {
      userId: 1,
      items: [
        { productId: 3, quantity: 1 } // Out of stock Headphones
      ]
    };
    const failedRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(failedPayload)
    });
    const failedResult = await failedRes.json();
    console.log('Failed Order Response:', failedRes.status, failedResult);
    if (failedRes.status !== 400) {
      throw new Error('Order should have failed with status 400');
    }

    // Verify stock remains unchanged
    const prodRes3 = await fetch(`${baseUrl}/api/products`);
    const products3 = await prodRes3.json();
    const laptop3 = products3.find(p => p.id === 1);
    console.log(`Laptop stock after failed order: ${laptop3.stock} (expected: 8)`);
    if (laptop3.stock !== 8) {
      throw new Error('Stock should not have changed after failed order');
    }
    console.log('✅ Failure & Rollback passed\n');

    // 7. Cancel order
    console.log(`Testing PUT /api/orders/${orderId}/cancel...`);
    const cancelRes = await fetch(`${baseUrl}/api/orders/${orderId}/cancel`, {
      method: 'PUT'
    });
    const cancelResult = await cancelRes.json();
    console.log('Cancel Response:', cancelRes.status, cancelResult);
    if (cancelRes.status !== 200 || cancelResult.status !== 'cancelled') {
      throw new Error('Order cancellation failed');
    }
    console.log('✅ Order cancellation passed\n');

    // 8. Verify stock restored
    console.log('Verifying stock restoration...');
    const prodRes4 = await fetch(`${baseUrl}/api/products`);
    const products4 = await prodRes4.json();
    const laptop4 = products4.find(p => p.id === 1);
    console.log(`Laptop stock after cancellation: ${laptop4.stock} (expected: 10)`);
    if (laptop4.stock !== 10) {
      throw new Error('Product stock was not restored after cancellation');
    }
    console.log('✅ Stock restoration passed\n');

    // 9. Test idempotency of cancellation
    console.log(`Testing PUT /api/orders/${orderId}/cancel again (Idempotency)...`);
    const cancelRes2 = await fetch(`${baseUrl}/api/orders/${orderId}/cancel`, {
      method: 'PUT'
    });
    const cancelResult2 = await cancelRes2.json();
    console.log('Second Cancel Response:', cancelRes2.status, cancelResult2);
    if (cancelRes2.status !== 200 || cancelResult2.status !== 'cancelled') {
      throw new Error('Second order cancellation failed');
    }

    // Verify stock remains 10 (not increased further)
    const prodRes5 = await fetch(`${baseUrl}/api/products`);
    const products5 = await prodRes5.json();
    const laptop5 = products5.find(p => p.id === 1);
    console.log(`Laptop stock after second cancellation: ${laptop5.stock} (expected: 10)`);
    if (laptop5.stock !== 10) {
      throw new Error('Product stock was incorrectly modified on duplicate cancel request');
    }
    console.log('✅ Cancellation idempotency passed\n');

    console.log('🎉 All integration tests passed successfully! 🎉');
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    process.exit(1);
  }
}

runTests();
