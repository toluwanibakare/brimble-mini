import { Request, Response } from 'express';
import { DeploymentService } from '../services/deploymentService';

export const createDeployment = (req: Request, res: Response) => {
  const { repoUrl } = req.body;
  if (!repoUrl) {
    return res.status(400).json({ error: 'repoUrl is required' });
  }

  try {
    const deployment = DeploymentService.createDeployment(repoUrl);
    res.status(201).json(deployment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create deployment' });
  }
};

export const getDeployments = (req: Request, res: Response) => {
  try {
    const deployments = DeploymentService.getAllDeployments();
    res.json(deployments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch deployments' });
  }
};

export const getDeployment = (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const deployment = DeploymentService.getDeployment(id);
    if (!deployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }
    res.json(deployment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch deployment' });
  }
};

export const getLogs = (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const logs = DeploymentService.getLogs(id);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
};
