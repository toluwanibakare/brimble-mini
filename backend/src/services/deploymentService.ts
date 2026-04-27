import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';
import db from '../models/db';

export const logEvents = new EventEmitter();

export interface Deployment {
  id: string;
  repoUrl: string;
  status: 'pending' | 'building' | 'deploying' | 'running' | 'failed' | 'cancelled';
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
  private static activeProcesses: Map<string, ChildProcess> = new Map();
  private static cancelledDeployments: Set<string> = new Set();

  static createDeployment(repoUrl: string): Deployment {
    const id = uuidv4();
    const statement = db.prepare(`
      INSERT INTO deployments (id, repoUrl)
      VALUES (?, ?)
    `);
    statement.run(id, repoUrl);
    
    return this.getDeployment(id)!;
  }

  static clearCancellation(deploymentId: string) {
    this.cancelledDeployments.delete(deploymentId);
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

  static registerProcess(deploymentId: string, process: ChildProcess) {
    this.activeProcesses.set(deploymentId, process);
  }

  static unregisterProcess(deploymentId: string, process?: ChildProcess) {
    const activeProcess = this.activeProcesses.get(deploymentId);
    if (!activeProcess) return;
    if (!process || activeProcess.pid === process.pid) {
      this.activeProcesses.delete(deploymentId);
    }
  }

  static isCancelled(deploymentId: string) {
    if (this.cancelledDeployments.has(deploymentId)) {
      return true;
    }

    const deployment = this.getDeployment(deploymentId);
    return deployment?.status === 'cancelled';
  }

  static cancelDeployment(deploymentId: string) {
    this.cancelledDeployments.add(deploymentId);
    const child = this.activeProcesses.get(deploymentId);
    if (child) {
      try {
        // Kill entire process group to clean up child processes
        if (child.pid) process.kill(-child.pid, 'SIGKILL');
      } catch {
        try { child.kill('SIGKILL'); } catch { /* already dead */ }
      }
      this.activeProcesses.delete(deploymentId);
    }
    this.updateStatus(deploymentId, 'cancelled');
    this.addLog(deploymentId, 'Deployment cancelled by user.');
  }

  static addLog(deploymentId: string, message: string) {
    const statement = db.prepare('INSERT INTO logs (deploymentId, message) VALUES (?, ?)');
    const result = statement.run(deploymentId, message);
    logEvents.emit('new-log', {
      id: Number(result.lastInsertRowid),
      deploymentId,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  static getLogs(deploymentId: string): Log[] {
    const statement = db.prepare('SELECT * FROM logs WHERE deploymentId = ? ORDER BY timestamp ASC');
    return statement.all(deploymentId) as Log[];
  }
}
