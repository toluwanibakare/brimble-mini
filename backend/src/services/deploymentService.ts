import { v4 as uuidv4 } from 'uuid';
import db from '../models/db';

export interface Deployment {
  id: string;
  repoUrl: string;
  status: 'pending' | 'building' | 'deploying' | 'running' | 'failed';
  imageTag?: string;
  containerId?: string;
  port?: number;
  url?: string;
  createdAt: string;
}

export interface Log {
  id: number;
  deploymentId: string;
  message: string;
  timestamp: string;
}

export class DeploymentService {
  static createDeployment(repoUrl: string): Deployment {
    const id = uuidv4();
    const statement = db.prepare(`
      INSERT INTO deployments (id, repoUrl)
      VALUES (?, ?)
    `);
    statement.run(id, repoUrl);
    
    return this.getDeployment(id)!;
  }

  static getDeployment(id: string): Deployment | undefined {
    const statement = db.prepare('SELECT * FROM deployments WHERE id = ?');
    return statement.get(id) as Deployment | undefined;
  }

  static getAllDeployments(): Deployment[] {
    const statement = db.prepare('SELECT * FROM deployments ORDER BY createdAt DESC');
    return statement.all() as Deployment[];
  }

  static updateStatus(id: string, status: Deployment['status']) {
    const statement = db.prepare('UPDATE deployments SET status = ? WHERE id = ?');
    statement.run(status, id);
  }

  static addLog(deploymentId: string, message: string) {
    const statement = db.prepare('INSERT INTO logs (deploymentId, message) VALUES (?, ?)');
    statement.run(deploymentId, message);
  }

  static getLogs(deploymentId: string): Log[] {
    const statement = db.prepare('SELECT * FROM logs WHERE deploymentId = ? ORDER BY timestamp ASC');
    return statement.all() as Log[];
  }
}
