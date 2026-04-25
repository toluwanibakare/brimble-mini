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

app.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`);
});
