import { Request, Response } from "express";
import { OrderService } from "../services/orderService";

export class OrderController {
  static async createOrder(req: Request, res: Response) {
    const { userId, items } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "Missing required field: userId" });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Items must be a non-empty array" });
    }

    try {
      const result = await OrderService.createOrder({
        userId: Number(userId),
        items: items.map((item: any) => ({
          productId: Number(item.productId),
          quantity: Number(item.quantity),
        })),
      });

      return res.status(201).json(result);
    } catch (error: any) {
      const message = error.message;
      if (
        message.includes("not found") ||
        message.includes("Insufficient stock") ||
        message.includes("Concurrency conflict") ||
        message.includes("Invalid quantity")
      ) {
        return res.status(400).json({ error: message });
      }
      return res.status(500).json({ error: message });
    }
  }

  static async getOrder(req: Request, res: Response) {
    const orderId = Number(req.params.orderId);

    if (isNaN(orderId)) {
      return res.status(400).json({ error: "Invalid order ID" });
    }

    try {
      const orderDetails = await OrderService.getOrderDetails(orderId);
      if (!orderDetails) {
        return res.status(404).json({ error: `Order not found: ${orderId}` });
      }
      return res.status(200).json(orderDetails);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async cancelOrder(req: Request, res: Response) {
    const orderId = Number(req.params.orderId);

    if (isNaN(orderId)) {
      return res.status(400).json({ error: "Invalid order ID" });
    }

    try {
      const result = await OrderService.cancelOrder(orderId);
      return res.status(200).json(result);
    } catch (error: any) {
      const message = error.message;
      if (message.includes("Order not found")) {
        return res.status(404).json({ error: message });
      }
      if (message.includes("cannot be cancelled")) {
        return res.status(400).json({ error: message });
      }
      return res.status(500).json({ error: message });
    }
  }
}
