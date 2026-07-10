import { Router } from "express";
import { ProductController } from "../controllers/productController";
import { OrderController } from "../controllers/orderController";

const router = Router();

// Product routes
router.get("/products", ProductController.listProducts);

// Order routes
router.post("/orders", OrderController.createOrder);
router.get("/orders/:orderId", OrderController.getOrder);
router.put("/orders/:orderId/cancel", OrderController.cancelOrder);

export default router;
