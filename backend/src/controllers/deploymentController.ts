import { Request, Response } from 'express';
import { DeploymentService } from '../services/deploymentService';

export const createDeployment = (req: Request, res: Response) => {
  const { repoUrl } = req.body;
  if (!repoUrl) {
    return res.status(400).json({ error: 'repoUrl is required' });
  }

  try {
    const deployment = DeploymentService.createDeployment(repoUrl);
    
    // Trigger build process in background
    const { BuildService } = require('../services/buildService');
    BuildService.startBuild(deployment.id, repoUrl);
    
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

export const streamLogs = (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Deployment ID is required' });
  }
  
  try {
    // Set headers for SSE (Express 5 compatible)
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    
    // Disable timeout for this connection
    req.socket.setTimeout(0);
    req.socket.setKeepAlive(true);
    req.socket.setNoDelay(true);

    // Send an initial newline to flush headers and establish stream
    res.write('\n');

    // Send existing logs first
    try {
      const existingLogs = DeploymentService.getLogs(id);
      existingLogs.forEach(log => {
        res.write(`data: ${JSON.stringify(log)}\n\n`);
      });
    } catch (error) {
      console.error('Error fetching existing logs:', error);
    }
    
    // Listen for new logs
    const { logEvents } = require('../services/deploymentService');
    const logHandler = (log: any) => {
      if (log.deploymentId === id) {
        try {
          res.write(`data: ${JSON.stringify(log)}\n\n`);
        } catch (err) {
          // Log likely failed because connection closed
          cleanup();
        }
      }
    };

    logEvents.on('new-log', logHandler);

    // Keep connection alive with heartbeats every 15s
    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch (err) {
        cleanup();
      }
    }, 15000);

    const cleanup = () => {
      clearInterval(heartbeat);
      logEvents.off('new-log', logHandler);
      if (!res.writableEnded) res.end();
    };

    // Clean up on disconnect
    req.on('close', cleanup);
  } catch (error) {
    console.error('Error in streamLogs:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream logs' });
    } else {
      res.end();
    }
  }
};
