import { Router } from 'express';
import * as DeploymentController from '../controllers/deploymentController';

const router = Router();

router.post('/', DeploymentController.createDeployment);
router.get('/', DeploymentController.getDeployments);
router.get('/:id', DeploymentController.getDeployment);
router.get('/:id/logs', DeploymentController.getLogs);

export default router;
