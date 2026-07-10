import { Request, Response } from "express";
import db from "../config/database";

export class ProductController {
  static async listProducts(req: Request, res: Response) {
    try {
      const products = await db("products")
        .select("id", "name", "price", "stock")
        .orderBy("id", "asc");
      
      const formattedProducts = products.map((p) => ({
        id: p.id,
        name: p.name,
        price: parseFloat(p.price),
        stock: parseInt(p.stock),
      }));

      return res.status(200).json(formattedProducts);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}
