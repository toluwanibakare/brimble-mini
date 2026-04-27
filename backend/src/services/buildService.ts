import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import { DeploymentService } from './deploymentService';

interface RunCommandOptions {
  totalTimeoutMs?: number;
  inactivityTimeoutMs?: number;
}

export class BuildService {
  private static tempDir = path.join(__dirname, '../../.tmp/builds');

  static async startBuild(deploymentId: string, repoUrl: string) {
    const buildPath = path.join(this.tempDir, deploymentId);
    const imageTag = `brimble-app-${deploymentId}`;

    try {
      await fs.ensureDir(buildPath);

      DeploymentService.updateStatus(deploymentId, 'building');
      DeploymentService.addLog(deploymentId, `Starting build for ${repoUrl}`);

      DeploymentService.addLog(deploymentId, 'Cloning repository...');
      await this.cloneWithRetry(repoUrl, buildPath, deploymentId, 3);
      this.throwIfCancelled(deploymentId);

      await this.runImageBuild(buildPath, deploymentId, imageTag);
      this.throwIfCancelled(deploymentId);

      DeploymentService.addLog(deploymentId, 'Build successful! Starting deployment...');
      
      await this.deployContainer(deploymentId, imageTag);
      
      DeploymentService.addLog(deploymentId, 'Deployment successful! App is live.');
    } catch (error: any) {
      if (DeploymentService.isCancelled(deploymentId) || error.message === 'Deployment cancelled') {
        DeploymentService.updateStatus(deploymentId, 'cancelled');
        return;
      }

      DeploymentService.addLog(deploymentId, `Build failed: ${error.message}`);
      DeploymentService.updateStatus(deploymentId, 'failed');
    }
  }

  private static async deployContainer(deploymentId: string, imageTag: string) {
    const shortId = deploymentId.slice(0, 8);
    const containerName = `brimble-app-${shortId}`;
    const url = `http://app-${shortId}.localhost`;
    
    DeploymentService.updateStatus(deploymentId, 'deploying');
    
    try {
      // Stop and remove any existing container with the same name
      DeploymentService.addLog(deploymentId, 'Cleaning up existing containers...');
      await this.runCommand('docker', ['rm', '-f', containerName], process.cwd(), deploymentId);
    } catch {
      // Ignore if doesn't exist
    }

    DeploymentService.addLog(deploymentId, `Running container: ${containerName}`);
    
    // Start the container
    // We attach it to the 'brimble' network so Caddy can reach it by name
    await this.runCommand(
      'docker',
      [
        'run', '-d',
        '--name', containerName,
        '--network', 'brimble',
        '--restart', 'always',
        '-e', 'PORT=3000', // Standard port for nixpacks/railpack
        imageTag
      ],
      process.cwd(),
      deploymentId
    );

    // Update database with container info and final status
    const db = (await import('../models/db')).default;
    db.prepare('UPDATE deployments SET status = ?, containerId = ?, url = ?, imageTag = ? WHERE id = ?')
      .run('running', containerName, url, imageTag, deploymentId);
      
    DeploymentService.updateStatus(deploymentId, 'running');
    DeploymentService.addLog(deploymentId, `App is now running at ${url}`);
  }



  private static async cloneWithRetry(
    repoUrl: string,
    buildPath: string,
    deploymentId: string,
    maxRetries: number
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      this.throwIfCancelled(deploymentId);

      try {
        await fs.emptyDir(buildPath);

        await this.runCommand(
          'git',
          [
            '-c', 'http.postBuffer=524288000',
            '-c', 'http.lowSpeedLimit=0',
            '-c', 'http.lowSpeedTime=999999',
            'clone',
            '--depth', '1',
            '--single-branch',
            '--no-tags',
            '--progress',
            repoUrl,
            '.',
          ],
          buildPath,
          deploymentId,
          { totalTimeoutMs: 1800000, inactivityTimeoutMs: 180000 }
        );

        return;
      } catch (error: any) {
        if (DeploymentService.isCancelled(deploymentId) || error.message === 'Deployment cancelled') {
          throw new Error('Deployment cancelled');
        }

        lastError = error;
        DeploymentService.addLog(
          deploymentId,
          `[ERROR] Clone attempt ${attempt}/${maxRetries} failed: ${error.message}`
        );

        if (attempt < maxRetries) {
          const delaySec = attempt * 3;
          DeploymentService.addLog(deploymentId, `Retrying in ${delaySec}s...`);
          await this.waitForRetryWindow(delaySec * 1000, deploymentId);
        }
      }
    }

    throw lastError ?? new Error('Clone failed after all retries');
  }

  private static killProcess(child: ChildProcess) {
    try {
      if (child.pid) {
        process.kill(-child.pid, 'SIGKILL');
      }
    } catch {
      try {
        child.kill('SIGKILL');
      } catch {
        // Process already exited.
      }
    }
  }

  private static async runImageBuild(
    buildPath: string,
    deploymentId: string,
    imageTag: string
  ) {
    const buildOptions = { totalTimeoutMs: 1800000, inactivityTimeoutMs: 180000 };
    const builder = (process.env.BUILD_CLI ?? 'railpack').trim();

    try {
      DeploymentService.addLog(
        deploymentId,
        `Executing ${builder} build...`
      );
      await this.runCommand(
        builder,
        ['build', '.', '--name', imageTag],
        buildPath,
        deploymentId,
        buildOptions
      );
    } catch (error: any) {
      const missingBuilder =
        error.message.includes(`Failed to spawn ${builder}`) &&
        error.message.includes('ENOENT');

      if (missingBuilder) {
        throw new Error(
          `Railpack is not installed in the backend runtime. Install railpack and ensure it is on PATH, or set BUILD_CLI to the correct railpack binary name.`
        );
      }
      throw error;
    }
  }

  private static runCommand(
    command: string,
    args: string[],
    cwd: string,
    deploymentId: string,
    options: RunCommandOptions = {}
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const totalTimeoutMs = options.totalTimeoutMs ?? 300000;
        const inactivityTimeoutMs = options.inactivityTimeoutMs ?? 120000;
        const child = spawn(command, args, {
          cwd,
          detached: true,
          env: (() => {
            const env: Record<string, string | undefined> = {
              ...process.env,
              GIT_TERMINAL_PROMPT: '0',
            };
            delete env.GIT_CURL_VERBOSE;
            delete env.GIT_TRACE_CURL;
            delete env.GIT_TRACE;
            delete env.GIT_TRACE_PACKET;
            delete env.GIT_TRACE_PERFORMANCE;
            return env;
          })(),
        });

        DeploymentService.registerProcess(deploymentId, child);

        let settled = false;
        let lastActivityMs = Date.now();
        let lastLoggedPct = -1;
        let inactivityTimer: NodeJS.Timeout | undefined;

        const settle = (fn: () => void) => {
          if (settled) return;

          settled = true;
          clearTimeout(totalTimer);
          clearTimeout(inactivityTimer);
          clearInterval(heartbeat);
          DeploymentService.unregisterProcess(deploymentId, child);
          fn();
        };

        const resetInactivityTimer = () => {
          lastActivityMs = Date.now();
          clearTimeout(inactivityTimer);
          inactivityTimer = setTimeout(() => {
            if (settled) return;

            DeploymentService.addLog(
              deploymentId,
              `[ERROR] ${command} produced no output for ${Math.round(inactivityTimeoutMs / 1000)}s - killing process`
            );
            this.killProcess(child);
            settle(() => reject(new Error(`${command} became unresponsive after ${Math.round(inactivityTimeoutMs / 1000)}s`)));
          }, inactivityTimeoutMs);
        };

        const totalTimer = setTimeout(() => {
          if (settled) return;

          DeploymentService.addLog(
            deploymentId,
            `[ERROR] ${command} timed out after ${Math.round(totalTimeoutMs / 1000)}s - killing process`
          );
          this.killProcess(child);
          settle(() => reject(new Error(`${command} timed out after ${Math.round(totalTimeoutMs / 1000)}s`)));
        }, totalTimeoutMs);

        resetInactivityTimer();

        const heartbeat = setInterval(() => {
          if (settled) return;

          const silenceMs = Date.now() - lastActivityMs;
          if (silenceMs >= 10000) {
            const silenceSec = Math.round(silenceMs / 1000);
            DeploymentService.addLog(
              deploymentId,
              `... still working (${silenceSec}s elapsed, waiting for data)`
            );
          }
        }, 10000);

        child.stdout?.on('data', (data) => {
          resetInactivityTimer();
          const lines = data.toString().split('\n');
          for (const line of lines) {
            const message = line.trim();
            if (message) {
              DeploymentService.addLog(deploymentId, message);
            }
          }
        });

        child.stderr?.on('data', (data) => {
          resetInactivityTimer();
          const lines = data.toString().split(/[\r\n]+/);

          for (const line of lines) {
            const message = line.trim();
            if (!message) continue;

            const lower = message.toLowerCase();
            const isProgress =
              lower.includes('cloning into') ||
              lower.includes('remote:') ||
              lower.includes('resolving deltas') ||
              lower.includes('updating files') ||
              lower.includes('receiving objects') ||
              lower.includes('counting objects') ||
              lower.includes('compressing objects') ||
              lower.includes('enumerating objects');

            if (isProgress) {
              const pctMatch = message.match(/(\d+)%/);
              if (pctMatch) {
                const pct = parseInt(pctMatch[1], 10);
                const bucket = Math.floor(pct / 10) * 10;
                if (bucket === lastLoggedPct && pct < 100) {
                  continue;
                }
                lastLoggedPct = bucket;
              }

              DeploymentService.addLog(deploymentId, message);
              continue;
            }

            DeploymentService.addLog(deploymentId, `[ERROR] ${message}`);
          }
        });

        child.on('error', (err) => {
          const message = `Failed to spawn ${command}: ${err.message}`;
          DeploymentService.addLog(deploymentId, `[ERROR] ${message}`);
          settle(() => reject(new Error(message)));
        });

        child.on('close', (code) => {
          settle(() => {
            if (DeploymentService.isCancelled(deploymentId)) {
              reject(new Error('Deployment cancelled'));
              return;
            }

            if (code === 0) {
              resolve();
              return;
            }

            reject(new Error(`${command} exited with code ${code}`));
          });
        });
      } catch (err: any) {
        const message = `Error running ${command}: ${err.message}`;
        DeploymentService.addLog(deploymentId, `[ERROR] ${message}`);
        reject(err);
      }
    });
  }

  private static throwIfCancelled(deploymentId: string) {
    if (DeploymentService.isCancelled(deploymentId)) {
      throw new Error('Deployment cancelled');
    }
  }

  private static async waitForRetryWindow(delayMs: number, deploymentId: string) {
    const stepMs = 250;
    let elapsedMs = 0;

    while (elapsedMs < delayMs) {
      this.throwIfCancelled(deploymentId);
      const waitMs = Math.min(stepMs, delayMs - elapsedMs);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      elapsedMs += waitMs;
    }
  }
}
