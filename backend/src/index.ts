import express from 'express';
import cors from 'cors';

import deploymentRoutes from './routes/deploymentRoutes';

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/deployments', deploymentRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Brimble Mini API is running' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'backend' });
});

// Global error handler to prevent crashes
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

app.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`);
});
