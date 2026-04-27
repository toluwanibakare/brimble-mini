import { Router } from 'express';
import * as DeploymentController from '../controllers/deploymentController';

const router = Router();

router.post('/', DeploymentController.createDeployment);
router.get('/', DeploymentController.getDeployments);

// More specific routes MUST come before /:id
router.get('/:id/logs/stream', DeploymentController.streamLogs);
router.post('/:id/cancel', DeploymentController.cancelDeployment);
router.get('/:id/logs', DeploymentController.getLogs);
router.get('/:id', DeploymentController.getDeployment);

export default router;
