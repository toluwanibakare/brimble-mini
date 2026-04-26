import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import { DeploymentService } from './deploymentService';

export class BuildService {
  private static tempDir = path.join(__dirname, '../../.tmp/builds');

  static async startBuild(deploymentId: string, repoUrl: string) {
    const buildPath = path.join(this.tempDir, deploymentId);
    const imageTag = `brimble-app-${deploymentId}`;

    try {
      // 1. Ensure temp dir exists
      await fs.ensureDir(buildPath);
      
      DeploymentService.updateStatus(deploymentId, 'building');
      DeploymentService.addLog(deploymentId, `Starting build for ${repoUrl}`);

      // 2. Clone repo (shallow clone for speed)
      DeploymentService.addLog(deploymentId, 'Cloning repository...');
      await this.runCommand('git', ['clone', '--depth', '1', '--single-branch', repoUrl, '.'], buildPath, deploymentId);

      // 3. Build with Docker (simpler than Nixpacks for now)
      DeploymentService.addLog(deploymentId, 'Building Docker image...');
      // For now, just use docker build
      await this.runCommand('docker', ['build', '-t', imageTag, '.'], buildPath, deploymentId);

      DeploymentService.addLog(deploymentId, 'Build successful!');
      
      // Update deployment with image tag and move to next status
      const db = (await import('../models/db')).default;
      db.prepare('UPDATE deployments SET imageTag = ?, status = ? WHERE id = ?')
        .run(imageTag, 'deploying', deploymentId);

      DeploymentService.addLog(deploymentId, 'Ready for deployment.');

    } catch (error: any) {
      DeploymentService.addLog(deploymentId, `Build failed: ${error.message}`);
      DeploymentService.updateStatus(deploymentId, 'failed');
    }
  }

  private static runCommand(command: string, args: string[], cwd: string, deploymentId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const child = spawn(command, args, { 
          cwd,
          env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
        });

        child.stdout?.on('data', (data) => {
          const message = data.toString().trim();
          if (message) DeploymentService.addLog(deploymentId, message);
        });

        child.stderr?.on('data', (data) => {
          const message = data.toString().trim();
          if (message) {
            const isProgress = message.toLowerCase().includes('cloning into') || 
                              message.toLowerCase().includes('remote:') ||
                              message.toLowerCase().includes('receiving objects:');
            
            DeploymentService.addLog(deploymentId, isProgress ? message : `[ERROR] ${message}`);
          }
        });

        child.on('error', (err) => {
          const message = `Failed to spawn ${command}: ${err.message}`;
          DeploymentService.addLog(deploymentId, `[ERROR] ${message}`);
          reject(new Error(message));
        });

        child.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`${command} exited with code ${code}`));
          }
        });
      } catch (err: any) {
        const message = `Error running ${command}: ${err.message}`;
        DeploymentService.addLog(deploymentId, `[ERROR] ${message}`);
        reject(err);
      }
    });
  }
}
