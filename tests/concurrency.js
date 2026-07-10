const baseUrl = 'http://localhost:8080';

async function runConcurrencyTest() {
  console.log('🚀 Starting concurrency tests...\n');

  try {
    // 1. Check initial product stock
    const prodRes = await fetch(`${baseUrl}/api/products`);
    const products = await prodRes.json();
    const laptopBefore = products.find(p => p.id === 1);
    console.log(`Laptop stock before concurrent orders: ${laptopBefore.stock}`);

    // 2. Dispatch 5 order creation requests in parallel
    const orderPayload = {
      userId: 1,
      items: [
        { productId: 1, quantity: 1 }
      ]
    };

    console.log('Sending 5 parallel orders for Laptop...');
    const promises = Array.from({ length: 5 }).map(() =>
      fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      })
    );

    const responses = await Promise.all(promises);
    const results = await Promise.all(responses.map(async (res) => {
      const body = await res.json();
      return { status: res.status, body };
    }));

    let successCount = 0;
    let conflictCount = 0;
    let insufficientStockCount = 0;
    let otherErrorCount = 0;

    results.forEach(({ status, body }) => {
      if (status === 201) {
        successCount++;
        console.log(`✅ Success: Created order ID ${body.orderId}`);
      } else if (status === 400) {
        if (body.error && body.error.includes('Concurrency conflict')) {
          conflictCount++;
          console.log(`⚠️ Concurrency Conflict expectedly prevented: "${body.error}"`);
        } else if (body.error && body.error.includes('Insufficient stock')) {
          insufficientStockCount++;
          console.log(`🚫 Insufficient Stock prevented: "${body.error}"`);
        } else {
          otherErrorCount++;
          console.log(`❌ Failed with error: ${body.error}`);
        }
      } else {
        otherErrorCount++;
        console.log(`❌ Failed with status ${status}:`, body);
      }
    });

    console.log('\n--- Concurrency Test Summary ---');
    console.log(`Successful Orders: ${successCount}`);
    console.log(`Optimistic Lock Conflicts Blocked: ${conflictCount}`);
    console.log(`Insufficient Stock Blocked: ${insufficientStockCount}`);
    console.log(`Other Errors: ${otherErrorCount}`);

    // Verify stock remains consistent
    const prodRes2 = await fetch(`${baseUrl}/api/products`);
    const products2 = await prodRes2.json();
    const laptopAfter = products2.find(p => p.id === 1);
    console.log(`\nLaptop stock after concurrent orders: ${laptopAfter.stock}`);

    const expectedStock = laptopBefore.stock - successCount;
    console.log(`Expected stock: ${expectedStock}`);

    if (laptopAfter.stock !== expectedStock) {
      throw new Error(`Data inconsistency! Stock is ${laptopAfter.stock} but expected ${expectedStock}`);
    }

    console.log('✅ Concurrency tests passed successfully (No race conditions detected)!');
  } catch (error) {
    console.error('❌ Concurrency test failed:', error.message);
    process.exit(1);
  }
}

runConcurrencyTest();
