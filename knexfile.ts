import type { Knex } from "knex";
import dotenv from "dotenv";

dotenv.config();

const config: Knex.Config = {
  client: "postgresql",
  connection: process.env.DATABASE_URL || "postgresql://user:password@localhost:5432/ecommerce",
  pool: {
    min: 2,
    max: 10
  },
  migrations: {
    tableName: "knex_migrations",
    directory: "./migrations"
  }
};

export default config;
module.exports = config;
