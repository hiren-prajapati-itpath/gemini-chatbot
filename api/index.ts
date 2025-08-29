// Vercel serverless function entry point
// This file re-exports the main Express app for Vercel deployment

import app from '../dist/index.js';

export default app;
