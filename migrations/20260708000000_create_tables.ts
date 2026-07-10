import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // users table
  const hasUsers = await knex.schema.hasTable("users");
  if (!hasUsers) {
    await knex.schema.createTable("users", (table) => {
      table.increments("id").primary();
      table.string("email", 255).unique().notNullable();
      table.string("password", 255).notNullable();
      table.timestamp("created_at").defaultTo(knex.fn.now());
    });
  }

  // products table
  const hasProducts = await knex.schema.hasTable("products");
  if (!hasProducts) {
    await knex.schema.createTable("products", (table) => {
      table.increments("id").primary();
      table.string("name", 255).notNullable();
      table.decimal("price", 10, 2).notNullable();
      table.integer("stock").notNullable();
      table.integer("version").notNullable().defaultTo(0);
      table.timestamp("created_at").defaultTo(knex.fn.now());
    });
    // Add check constraint for stock
    await knex.raw('ALTER TABLE products ADD CONSTRAINT products_stock_check CHECK (stock >= 0)');
  }

  // orders table
  const hasOrders = await knex.schema.hasTable("orders");
  if (!hasOrders) {
    await knex.schema.createTable("orders", (table) => {
      table.increments("id").primary();
      table.integer("user_id").unsigned().notNullable().references("id").inTable("users").onDelete("CASCADE");
      table.string("status", 50).notNullable();
      table.decimal("total_amount", 10, 2).notNullable();
      table.timestamp("created_at").defaultTo(knex.fn.now());
    });
  }

  // order_items table
  const hasOrderItems = await knex.schema.hasTable("order_items");
  if (!hasOrderItems) {
    await knex.schema.createTable("order_items", (table) => {
      table.increments("id").primary();
      table.integer("order_id").unsigned().notNullable().references("id").inTable("orders").onDelete("CASCADE");
      table.integer("product_id").unsigned().notNullable().references("id").inTable("products").onDelete("RESTRICT");
      table.integer("quantity").notNullable();
      table.decimal("price", 10, 2).notNullable();
    });
    // Add check constraint for quantity
    await knex.raw('ALTER TABLE order_items ADD CONSTRAINT order_items_quantity_check CHECK (quantity > 0)');
  }

  // payments table
  const hasPayments = await knex.schema.hasTable("payments");
  if (!hasPayments) {
    await knex.schema.createTable("payments", (table) => {
      table.increments("id").primary();
      table.integer("order_id").unsigned().notNullable().references("id").inTable("orders").onDelete("CASCADE");
      table.decimal("amount", 10, 2).notNullable();
      table.string("status", 50).notNullable();
      table.timestamp("created_at").defaultTo(knex.fn.now());
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("payments");
  await knex.schema.dropTableIfExists("order_items");
  await knex.schema.dropTableIfExists("orders");
  await knex.schema.dropTableIfExists("products");
  await knex.schema.dropTableIfExists("users");
}
