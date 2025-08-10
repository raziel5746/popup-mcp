import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { ExtensionConfig } from '../types';
import { logger } from './logger';

/**
 * ChimePlayer handles playing notification sounds for popup display
 * Implements AC: 4 - Plays provided WAV file as chime sound on display (if not muted)
 */
export class ChimePlayer {
  private audioContext: any | undefined; // Using any to avoid AudioContext dependency in Node.js
  private audioBuffer: any | undefined;   // Using any to avoid AudioBuffer dependency in Node.js
  private isInitialized = false;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly context: vscode.ExtensionContext
  ) {}

  /**
   * Initializes the audio context and loads the chime audio file
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Note: In VS Code extension context, we need to use a different approach
      // since AudioContext might not be available. We'll use VS Code's built-in
      // notification sound or system beep as fallback
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize chime player:', error);
    }
  }

  /**
   * Plays the chime sound if enabled in configuration
   */
  public async playChime(): Promise<void> {
    try {
      // Check if chime is enabled in configuration
      const config = this.getExtensionConfig();
      if (!config.chimeEnabled) {
        logger.debug('Chime disabled in configuration');
        return;
      }

      await this.playWavFile();
      
    } catch (error) {
      logger.error('Failed to play chime:', error);
      // Fallback to console beep
      console.log('\x07'); // ASCII bell character
    }
  }

  /**
   * Plays the actual WAV file using cross-platform system commands
   */
  private async playWavFile(): Promise<void> {
    const config = this.getExtensionConfig();
    const volume = config.chimeVolume / 100;
    const soundPath = path.join(this.extensionUri.fsPath, 'assets', 'chime.wav');

    logger.info(`[Sound] Attempting playback at: ${soundPath}`);

    // Check if the chime file exists
    if (!fs.existsSync(soundPath)) {
      logger.error('[Sound] Error: File not found! Check if assets/chime.wav is bundled.');
      throw new Error('Chime file not found');
    }

    // Determine the command and arguments based on platform
    let command: string;
    let args: string[] = [];

    if (process.platform === 'win32') {
      command = 'powershell';
      args = [
        '-NoProfile', 
        '-c', 
        `(New-Object Media.SoundPlayer '${soundPath.replace(/\//g, '\\')}').PlaySync()`
      ];
    } else if (process.platform === 'darwin') {
      command = 'afplay';
      args = [soundPath, '-v', volume.toString()];
    } else {
      // Linux and other Unix-like systems
      command = 'aplay';
      args = ['-v', volume.toString(), soundPath];
    }

    logger.info(`[Sound] Spawning: ${command} ${args.join(' ')}`);

    return new Promise<void>((resolve, reject) => {
      const proc = spawn(command, args, { shell: true });

      proc.stdout?.on('data', (data) => {
        logger.debug(`[Sound] stdout: ${data}`);
      });

      proc.stderr?.on('data', (data) => {
        logger.debug(`[Sound] stderr: ${data}`);
      });

      proc.on('error', (err) => {
        logger.error(`[Sound] Playback error: ${err.message}`);
        reject(err);
      });

      proc.on('close', (code) => {
        logger.info(`[Sound] Process closed with code ${code}`);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Audio playback failed with code ${code}`));
        }
      });
    });
  }

  /**
   * Gets the current extension configuration
   */
  private getExtensionConfig(): ExtensionConfig {
    const config = vscode.workspace.getConfiguration('popupmcp');
    
    return {
      chimeEnabled: config.get<boolean>('chimeEnabled', true),
      chimeVolume: config.get<number>('chimeVolume', 50),
      popupTimeout: config.get<number>('popupTimeout', 30),
      httpPort: config.get<number>('httpPort', 0),
      enableStdio: config.get<boolean>('enableStdio', true),
      enableHttp: config.get<boolean>('enableHttp', true),
      logLevel: config.get<'debug' | 'info' | 'warn' | 'error'>('logLevel', 'info')
    };
  }

  /**
   * Updates the chime enabled setting
   */
  public async setChimeEnabled(enabled: boolean): Promise<void> {
    const config = vscode.workspace.getConfiguration('popupmcp');
    await config.update('chimeEnabled', enabled, vscode.ConfigurationTarget.Global);
  }

  /**
   * Checks if chime is currently enabled
   */
  public isChimeEnabled(): boolean {
    return this.getExtensionConfig().chimeEnabled;
  }

  /**
   * Disposes of audio resources
   */
  public dispose(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = undefined;
    }
    this.audioBuffer = undefined;
    this.isInitialized = false;
  }
}
