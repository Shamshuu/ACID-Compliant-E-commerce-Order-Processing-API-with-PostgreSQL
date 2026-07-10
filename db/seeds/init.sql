-- Create tables if they do not exist
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    stock INTEGER NOT NULL CHECK (stock >= 0),
    version INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price DECIMAL(10, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial data
INSERT INTO users (id, email, password)
VALUES 
    (1, 'alice@example.com', '$2b$10$tMh4bE1YV8Wv4T/eFm442Oe4sJ2WnE/H3lSgD1K6vB8K066yH6d5y'),
    (2, 'bob@example.com', '$2b$10$tMh4bE1YV8Wv4T/eFm442Oe4sJ2WnE/H3lSgD1K6vB8K066yH6d5y')
ON CONFLICT (id) DO NOTHING;

-- Reset users serial sequence to avoid conflicts on dynamic inserts
SELECT setval(pg_get_serial_sequence('users', 'id'), coalesce(max(id), 1)) FROM users;

INSERT INTO products (id, name, price, stock, version)
VALUES
    (1, 'Laptop', 999.99, 10, 0),
    (2, 'Smartphone', 499.99, 20, 0),
    (3, 'Headphones', 99.99, 0, 0),
    (4, 'Keyboard', 49.99, 15, 0),
    (5, 'Mouse', 29.99, 30, 0)
ON CONFLICT (id) DO NOTHING;

-- Reset products serial sequence to avoid conflicts on dynamic inserts
SELECT setval(pg_get_serial_sequence('products', 'id'), coalesce(max(id), 1)) FROM products;
