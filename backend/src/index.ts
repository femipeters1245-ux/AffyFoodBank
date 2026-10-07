// backend/src/index.ts
import 'express-async-errors'; // Patch Express to forward async errors to next()
import app from './app';
import logger from './utils/logger';

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, () => {
  logger.info(`🚀 FoodBank API listening on http://localhost:${PORT}`);
});
