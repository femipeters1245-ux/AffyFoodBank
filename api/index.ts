// api/index.ts
// Thin Vercel serverless adapter — wraps the Express app without modifying it.
// Vercel invokes this file as a Node.js serverless function for every /api/* request.

import 'express-async-errors';
import app from '../backend/src/app';

export default app;
