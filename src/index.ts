import app from "./app";
import dotenv from "dotenv";
import logger from "./utils/logger";

dotenv.config();

const port = process.env.API_PORT || 8080;

app.listen(port, () => {
  logger.info(`Server is running on port ${port}`, { port });
});
