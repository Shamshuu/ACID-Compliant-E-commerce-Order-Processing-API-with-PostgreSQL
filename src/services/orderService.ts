import { randomUUID } from "crypto";
import db from "../config/database";
import logger from "../utils/logger";

export interface OrderItemInput {
  productId: number;
  quantity: number;
}

export interface CreateOrderInput {
  userId: number;
  items: OrderItemInput[];
}

export class OrderService {
  /**
   * Create a new order inside an atomic transaction with optimistic locking on product stock.
   */
  static async createOrder(input: CreateOrderInput) {
    const txId = randomUUID();
    logger.info("TRANSACTION_START", { txId, userId: input.userId, items: input.items });

    const trx = await db.transaction();

    try {
      // 1. Verify user exists
      const user = await trx("users").where({ id: input.userId }).first();
      if (!user) {
        throw new Error(`User not found: ${input.userId}`);
      }

      let totalAmount = 0;
      const verifiedItems: Array<{
        productId: number;
        quantity: number;
        price: number;
        name: string;
        currentStock: number;
        currentVersion: number;
      }> = [];

      // 2. Fetch and check stock for all items
      for (const item of input.items) {
        if (item.quantity <= 0) {
          throw new Error(`Invalid quantity ${item.quantity} for product ID ${item.productId}`);
        }

        const product = await trx("products")
          .where({ id: item.productId })
          .first();

        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        if (product.stock < item.quantity) {
          logger.error("INVENTORY_CHECK_FAILURE", {
            txId,
            productId: item.productId,
            requestedQuantity: item.quantity,
            currentStock: product.stock,
          });
          throw new Error(`Insufficient stock for product "${product.name}". Required: ${item.quantity}, Available: ${product.stock}`);
        }

        logger.info("INVENTORY_CHECK_SUCCESS", {
          txId,
          productId: item.productId,
          requestedQuantity: item.quantity,
          currentStock: product.stock,
        });

        const itemPrice = parseFloat(product.price);
        totalAmount += itemPrice * item.quantity;

        verifiedItems.push({
          productId: item.productId,
          quantity: item.quantity,
          price: itemPrice,
          name: product.name,
          currentStock: product.stock,
          currentVersion: product.version,
        });
      }

      // 3. Decrement stock using optimistic locking
      for (const item of verifiedItems) {
        const newStock = item.currentStock - item.quantity;
        
        const updatedRows = await trx("products")
          .where({ id: item.productId, version: item.currentVersion })
          .update({
            stock: newStock,
            version: item.currentVersion + 1,
          });

        if (updatedRows === 0) {
          logger.error("CONCURRENCY_CONFLICT", {
            txId,
            productId: item.productId,
            expectedVersion: item.currentVersion,
          });
          throw new Error(`Concurrency conflict: stock for product "${item.name}" was modified by another transaction. Please retry.`);
        }
      }

      // 4. Create the order record
      const [newOrder] = await trx("orders")
        .insert({
          user_id: input.userId,
          status: "processing",
          total_amount: totalAmount,
        })
        .returning("*");

      // 5. Create order items records
      for (const item of verifiedItems) {
        await trx("order_items").insert({
          order_id: newOrder.id,
          product_id: item.productId,
          quantity: item.quantity,
          price: item.price,
        });
      }

      // 6. Create payment record (succeeded)
      await trx("payments").insert({
        order_id: newOrder.id,
        amount: totalAmount,
        status: "succeeded",
      });

      // Commit transaction
      await trx.commit();
      logger.info("TRANSACTION_COMMIT", { txId, orderId: newOrder.id });

      return {
        orderId: newOrder.id,
        status: newOrder.status,
        totalAmount: parseFloat(newOrder.total_amount),
      };
    } catch (error: any) {
      // Rollback transaction
      await trx.rollback();
      logger.error("TRANSACTION_ROLLBACK", { txId, reason: error.message });
      throw error;
    }
  }

  /**
   * Cancel an order inside a transaction, restoring stock. Idempotent operation.
   */
  static async cancelOrder(orderId: number) {
    const txId = randomUUID();
    logger.info("ORDER_CANCELLATION_START", { txId, orderId });

    const trx = await db.transaction();

    try {
      // Fetch order with a pessimistic lock (FOR UPDATE) to serialize cancellation updates
      const order = await trx("orders")
        .where({ id: orderId })
        .forUpdate()
        .first();

      if (!order) {
        throw new Error(`Order not found: ${orderId}`);
      }

      // Idempotency: If already cancelled, return success without modifications
      if (order.status === "cancelled") {
        logger.info("ORDER_CANCELLATION_IDEMPOTENT", { txId, orderId });
        await trx.commit(); // release lock
        return {
          orderId: order.id,
          status: "cancelled",
        };
      }

      // Check if order is cancelable (only pending or processing can be cancelled)
      const nonCancelableStatuses = ["shipped", "delivered"];
      if (nonCancelableStatuses.includes(order.status.toLowerCase())) {
        throw new Error(`Order cannot be cancelled. Current status is: ${order.status}`);
      }

      // Update order status to cancelled
      await trx("orders")
        .where({ id: orderId })
        .update({ status: "cancelled" });

      // Fetch order items to restore stock
      const items = await trx("order_items")
        .where({ order_id: orderId });

      for (const item of items) {
        // Increment stock and increment version
        await trx("products")
          .where({ id: item.product_id })
          .increment("stock", item.quantity)
          .increment("version", 1);
      }

      await trx.commit();
      logger.info("ORDER_CANCELLATION_COMMIT", { txId, orderId });

      return {
        orderId: order.id,
        status: "cancelled",
      };
    } catch (error: any) {
      await trx.rollback();
      logger.error("ORDER_CANCELLATION_ROLLBACK", { txId, orderId, reason: error.message });
      throw error;
    }
  }

  /**
   * Retrieve details of a specific order, joining user and item details.
   */
  static async getOrderDetails(orderId: number) {
    const order = await db("orders")
      .where({ id: orderId })
      .first();

    if (!order) {
      return null;
    }

    const user = await db("users")
      .select("id", "email")
      .where({ id: order.user_id })
      .first();

    const items = await db("order_items")
      .join("products", "order_items.product_id", "products.id")
      .select(
        "order_items.product_id as productId",
        "products.name as productName",
        "order_items.quantity",
        "order_items.price"
      )
      .where({ "order_items.order_id": orderId });

    // Format fields
    const formattedItems = items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: parseInt(item.quantity),
      price: parseFloat(item.price),
    }));

    return {
      orderId: order.id,
      status: order.status,
      totalAmount: parseFloat(order.total_amount),
      createdAt: new Date(order.created_at).toISOString(),
      user: {
        id: user.id,
        email: user.email,
      },
      items: formattedItems,
    };
  }
}
