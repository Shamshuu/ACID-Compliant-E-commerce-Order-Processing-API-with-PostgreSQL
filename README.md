# ACID-Compliant E-commerce Order Processing API

A robust, containerized, and highly-consistent backend API designed to handle e-commerce order workflows. Built with **Node.js**, **TypeScript**, **Express**, **Knex.js**, and **PostgreSQL**.

The system implements ACID-compliant transactions and concurrency controls to guarantee data integrity, preventing issues like double-selling inventory or recording payments for failed orders.

---

## Technical Stack & Architecture
- **Language**: TypeScript
- **Runtime**: Node.js (v20 Alpine)
- **Framework**: Express.js
- **Database Engine**: PostgreSQL 13
- **SQL Builder & Migration**: Knex.js
- **Containerization**: Docker & Docker Compose
- **Structured Logger**: Winston (JSON Format)

### Architectural Design
The codebase is structured using a service-layer pattern to isolate business logic:
- **`src/index.ts`**: Express server bootstrap.
- **`src/app.ts`**: App configuration, global logger/error-handling middleware, and the `/health` endpoint.
- **`src/routes/`**: Handles path routing mapping endpoints to controllers.
- **`src/controllers/`**: Extracts parameters, handles request validation, and matches response schemas.
- **`src/services/`**: The core layer where database transactions, business logic, locks, and rollbacks are executed.
- **`src/config/`**: Manages connection pooling and database initialization.

---

## Concurrency Control: Optimistic Locking
To prevent race conditions when concurrent requests try to order the last item of a product, this API implements **Optimistic Locking** using a version-check pattern.

### How it works:
1. Every product contains a `version` column in the database (defaults to `0`).
2. When creating an order, the system reads the product's `stock` and `version` inside a transaction.
3. It performs validation (ensuring stock >= requested quantity).
4. When writing the updated stock, it issues the following query:
   ```sql
   UPDATE products 
   SET stock = :newStock, version = version + 1 
   WHERE id = :productId AND version = :currentVersion;
   ```
5. If another concurrent transaction successfully updated the same product first, the version column in the database will have changed. The update query affects `0` rows.
6. The application detects `affectedRows === 0`, throws a concurrency conflict exception, rolls back the entire transaction, and returns a `400 Bad Request` to the user to retry safely.

During order cancellation, a **Pessimistic Row Lock** (`SELECT ... FOR UPDATE`) is used to serialize status transitions for a specific order. This locks the order record to prevent duplicate cancellation requests from executing concurrently, ensuring idempotency.

---

## Database Schema
The database contains five core tables:
- **`users`**: Email and hashed passwords.
- **`products`**: Product details, price, inventory stock level, and locking `version`.
- **`orders`**: Tracks order status (`pending`, `processing`, `cancelled`, etc.) and amount.
- **`order_items`**: Mapping of items purchased within an order.
- **`payments`**: Records payment events (e.g. status `succeeded`, `failed`) for order references.

Migrations are managed with Knex and executed automatically on app start inside Docker. Seeding is executed automatically on database initialization.

---

## Environment Configuration

A `.env.example` file is included at the project root. Create a `.env` file containing the environment configuration before starting the services (a default `.env` is already configured for Docker):

```env
API_PORT=8080
DATABASE_URL=postgresql://user:password@db:5432/ecommerce
DB_USER=user
DB_PASSWORD=password
DB_NAME=ecommerce
```

---

## Getting Started

### Prerequisites
- Docker
- Docker Compose

### Launch Services
Start the PostgreSQL database and application in detatched mode:
```bash
docker-compose up --build -d
```
This single command:
1. Boots PostgreSQL and mounts `./db/seeds` to populate the users and products.
2. Compiles TypeScript and runs database migrations.
3. Health-checks both services (ensuring the database is fully initialized before the application starts accepting requests).

You can monitor logs using:
```bash
docker-compose logs -f app
```

---

## API Endpoints

### 1. Health Check
Checks DB connection and application status.
- **URL**: `GET /health`
- **Response (200 OK)**:
  ```json
  {
    "status": "ok",
    "db": "healthy"
  }
  ```
- **Response (503 Service Unavailable)**:
  ```json
  {
    "status": "error",
    "db": "unhealthy"
  }
  ```

### 2. List Products
Lists all items currently in the catalog.
- **URL**: `GET /api/products`
- **Response (200 OK)**:
  ```json
  [
    {
      "id": 1,
      "name": "Laptop",
      "price": 999.99,
      "stock": 10
    }
  ]
  ```

### 3. Create Order (Atomic Transaction)
Creates a transaction to deduct stock, record the order, create items, and process payment.
- **URL**: `POST /api/orders`
- **Body**:
  ```json
  {
    "userId": 1,
    "items": [
      {
        "productId": 1,
        "quantity": 2
      }
    ]
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "orderId": 1,
    "status": "processing",
    "totalAmount": 1999.98
  }
  ```

### 4. Get Order Details
Retrieves detailed information of an order, joining user and item records.
- **URL**: `GET /api/orders/:orderId`
- **Response (200 OK)**:
  ```json
  {
    "orderId": 1,
    "status": "processing",
    "totalAmount": 1999.98,
    "createdAt": "2026-07-08T09:27:50.334Z",
    "user": {
      "id": 1,
      "email": "alice@example.com"
    },
    "items": [
      {
        "productId": 1,
        "productName": "Laptop",
        "quantity": 2,
        "price": 999.99
      }
    ]
  }
  ```

### 5. Cancel Order (Transactional & Idempotent)
Cancels an order, updating the status and restoring product inventory. Repeated calls succeed without altering database state further.
- **URL**: `PUT /api/orders/:orderId/cancel`
- **Response (200 OK)**:
  ```json
  {
    "orderId": 1,
    "status": "cancelled"
  }
  ```

---

## Running Verification Tests

While the services are running, run the following verification scripts on the host to test requirements:

### Run Standard Integration Tests
Tests health status, order creation, order fetching, stock decrement validation, rollback validation (out-of-stock), order cancellation, and cancellation idempotency:
```bash
node tests/integration.js
```

### Run Concurrency / Optimistic Locking Tests
Spawns 5 parallel order requests for the same product to verify that race conditions are prevented, database conflicts are handled gracefully via rollbacks, and inventory levels stay consistent:
```bash
node tests/concurrency.js
```