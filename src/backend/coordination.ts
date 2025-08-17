/**
 * Instance coordination system for multi-instance MCP server management
 * Handles server/client election and request forwarding
 */

// import * as vscode from 'vscode'; // Currently unused
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as http from 'http';
import * as net from 'net';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export type InstanceRole = 'server-active' | 'client-active' | 'inactive';

export interface InstanceInfo {
  /** Unique instance identifier */
  instanceId: string;
  /** Current role of this instance */
  role: InstanceRole;
  /** Workspace path for this instance */
  workspacePath: string;
  /** Process ID for this instance */
  processId: number;
  /** Timestamp when this instance was last seen */
  lastSeen: number;
  /** HTTP port for server instances */
  httpPort?: number;
}

export interface CoordinationState {
  /** Currently elected server instance */
  serverInstance?: InstanceInfo;
  /** All known instances */
  instances: Map<string, InstanceInfo>;
  /** Last election timestamp */
  lastElection: number;
}

/**
 * Manages coordination between multiple VS Code instances
 * Implements election mechanism and request forwarding
 */
export class InstanceCoordinator extends EventEmitter {
  private instanceId: string;
  private currentRole: InstanceRole = 'inactive';
  private workspacePath: string;
  private httpPort?: number;
  private coordinationFile: string;
  private heartbeatInterval?: NodeJS.Timeout;
  private electionTimeout?: NodeJS.Timeout;
  private state: CoordinationState;
  private readonly HEARTBEAT_INTERVAL = 10000; // 10 seconds (reduced frequency)
  private readonly ELECTION_TIMEOUT = 15000; // 15 seconds (reduced frequency)  
  private readonly INSTANCE_TIMEOUT = 30000; // 30 seconds

  constructor(workspacePath: string, desiredHttpPort?: number) {
    super();
    this.instanceId = this.generateInstanceId();
    this.workspacePath = workspacePath;
    this.httpPort = desiredHttpPort; // Will be updated after port allocation
    this.coordinationFile = this.getCoordinationFilePath();
    this.state = {
      instances: new Map(),
      lastElection: 0
    };
    
    logger.info(`Instance coordinator initialized: ${this.instanceId} (${workspacePath})`);
  }

  /**
   * Starts the coordination system and begins election process
   */
  async start(): Promise<void> {
    try {
      logger.info('Starting instance coordination...');
      
      // Load existing state
      await this.loadState();
      
      // Determine role and allocate port BEFORE registering
      await this.performInitialElection();
      
      // Register this instance with allocated port
      await this.registerInstance();
      
      // Start heartbeat
      this.startHeartbeat();
      
      logger.info(`Instance coordination started with role: ${this.currentRole}, port: ${this.httpPort}`);
    } catch (error) {
      logger.error('Failed to start instance coordination:', error);
      throw error;
    }
  }

  /**
   * Stops the coordination system
   */
  async stop(): Promise<void> {
    try {
      logger.info('Stopping instance coordination...');
      
      const wasServer = this.currentRole === 'server-active';
      
      // Clear intervals first
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = undefined;
      }
      
      if (this.electionTimeout) {
        clearTimeout(this.electionTimeout);
        this.electionTimeout = undefined;
      }
      
      // Remove all listeners to prevent memory leaks
      this.removeAllListeners();
      
      // Unregister this instance
      await this.unregisterInstance();
      
      // If this was the server, clear server instance to trigger immediate re-election
      if (wasServer) {
        this.state.serverInstance = undefined;
        await this.saveState();
        logger.info('Server instance stopped - cleared server state for re-election');
      }
      
      this.currentRole = 'inactive';
      logger.info('Instance coordination stopped');
    } catch (error) {
      logger.error('Error stopping instance coordination:', error);
    }
  }

  /**
   * Gets the current role of this instance
   */
  getCurrentRole(): InstanceRole {
    return this.currentRole;
  }

  /**
   * Gets the current server instance info
   */
  getServerInstance(): InstanceInfo | undefined {
    return this.state.serverInstance;
  }

  /**
   * Gets all known instances
   */
  getAllInstances(): InstanceInfo[] {
    return Array.from(this.state.instances.values());
  }

  /**
   * Gets the allocated HTTP port for this instance
   */
  getAllocatedPort(): number | undefined {
    return this.httpPort;
  }

  /**
   * Gets the instance ID for this instance
   */
  getInstanceId(): string {
    return this.instanceId;
  }

  /**
   * Forwards a request to the server instance (for clients)
   */
  async forwardToServer(request: any): Promise<any> {
    if (this.currentRole === 'server-active') {
      throw new Error('Server instances should not forward requests');
    }
    
    const serverInstance = this.state.serverInstance;
    if (!serverInstance || !serverInstance.httpPort) {
      throw new Error('No server instance available for forwarding');
    }
    
    try {
      logger.info(`Forwarding request to server instance: ${serverInstance.instanceId}`);
      
      // Make HTTP request to server instance
      const response = await this.makeHttpRequest(
        `http://localhost:${serverInstance.httpPort}/mcp`,
        request
      );
      
      return response;
    } catch (error) {
      logger.error('Failed to forward request to server:', error);
      
      // Server might be down, trigger re-election
      await this.triggerElection();
      throw error;
    }
  }

  /**
   * Performs initial election using configured port discovery
   */
  private async performInitialElection(): Promise<void> {
    try {
      const configuredPort = this.httpPort || 9001;
      
      // Try to connect to the configured port to see if a server already exists
      const existingServer = await this.checkForExistingServer(configuredPort);
      
      if (existingServer) {
        // Become a client
        this.currentRole = 'client-active';
        this.httpPort = undefined; // Clients don't need HTTP ports
        logger.info(`Existing server found on configured port ${configuredPort}, becoming client`);
        
        // Store server info for client reference
        this.state.serverInstance = {
          instanceId: existingServer.instanceId || 'unknown',
          role: 'server-active',
          workspacePath: existingServer.workspacePath || '',
          processId: 0, // Unknown from health check
          lastSeen: Date.now(),
          httpPort: configuredPort
        };
      } else {
        // No server on configured port - become the server
        this.currentRole = 'server-active';
        this.httpPort = configuredPort;
        logger.info(`No server found on configured port ${configuredPort}, becoming server`);
        
        // Update server instance in state
        this.state.serverInstance = {
          instanceId: this.instanceId,
          role: this.currentRole,
          workspacePath: this.workspacePath,
          processId: process.pid,
          lastSeen: Date.now(),
          httpPort: this.httpPort
        };
      }
      
      // Still register this instance for tracking
      await this.registerInstance();
      
    } catch (error) {
      logger.error('Error during initial election:', error);
      this.currentRole = 'inactive';
      throw error;
    }
  }

  /**
   * Checks if there's already a server running on the configured port
   */
  private async checkForExistingServer(port: number): Promise<any | null> {
    try {
      logger.info(`Checking for existing server on port ${port}...`);
      
      // Use GET request for health check instead of POST
      const response = await this.makeHttpGetRequest(`http://localhost:${port}/health`);
      
      logger.info(`Found existing server on port ${port}:`, response);
      return response;
      
    } catch (error) {
      logger.info(`No server found on port ${port}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Makes an HTTP GET request for health checks
   */
  private async makeHttpGetRequest(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const req = http.request(url, { method: 'GET' }, (res: any) => {
        let responseData = '';
        
        res.on('data', (chunk: string) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(responseData);
            resolve(response);
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${responseData}`));
          }
        });
      });
      
      req.on('error', (error: Error) => {
        reject(error);
      });
      
      req.end();
    });
  }

  /**
   * Allocates an available HTTP port starting from the desired port
   */
  private async allocateAvailablePort(startingPort: number): Promise<number> {
    // Get all used ports from existing instances
    const usedPorts = new Set<number>();
    for (const instance of this.state.instances.values()) {
      if (instance.httpPort) {
        usedPorts.add(instance.httpPort);
      }
    }
    
    // Find first available port starting from the desired port
    let port = startingPort;
    while (port < startingPort + 100) { // Try up to 100 ports
      if (!usedPorts.has(port) && await this.isPortAvailable(port)) {
        logger.info(`Allocated port ${port} for instance ${this.instanceId}`);
        return port;
      }
      port++;
    }
    
    throw new Error(`No available ports found starting from ${startingPort}`);
  }

  /**
   * Checks if a port is available for binding
   */
  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.listen(port, 'localhost', () => {
        server.close(() => {
          resolve(true);
        });
      });
      
      server.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Generates a unique instance identifier
   */
  private generateInstanceId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    const pid = process.pid;
    return `vscode_${pid}_${timestamp}_${random}`;
  }

  /**
   * Gets the path for the coordination file
   */
  private getCoordinationFilePath(): string {
    const tempDir = os.tmpdir();
    return path.join(tempDir, 'popup-mcp-coordination.json');
  }

  /**
   * Loads coordination state from file
   */
  private async loadState(): Promise<void> {
    try {
      if (fs.existsSync(this.coordinationFile)) {
        const data = fs.readFileSync(this.coordinationFile, 'utf8');
        const savedState = JSON.parse(data);
        
        // Convert instances array back to Map
        this.state.instances = new Map(savedState.instances || []);
        this.state.serverInstance = savedState.serverInstance;
        this.state.lastElection = savedState.lastElection || 0;
        
        // Clean up stale instances
        await this.cleanupStaleInstances();
        
        // logger.debug('Coordination state loaded from file');
      }
    } catch (error) {
      logger.error('Failed to load coordination state:', error);
      // Continue with empty state
    }
  }

  /**
   * Saves coordination state to file
   */
  private async saveState(): Promise<void> {
    try {
      const stateToSave = {
        instances: Array.from(this.state.instances.entries()),
        serverInstance: this.state.serverInstance,
        lastElection: this.state.lastElection
      };
      
      fs.writeFileSync(this.coordinationFile, JSON.stringify(stateToSave, null, 2));
      // logger.debug('Coordination state saved to file');
    } catch (error) {
      logger.error('Failed to save coordination state:', error);
    }
  }

  /**
   * Registers this instance in the coordination state
   */
  private async registerInstance(): Promise<void> {
    const instanceInfo: InstanceInfo = {
      instanceId: this.instanceId,
      role: this.currentRole,
      workspacePath: this.workspacePath,
      processId: process.pid,
      lastSeen: Date.now(),
      httpPort: this.httpPort
    };
    
    this.state.instances.set(this.instanceId, instanceInfo);
    await this.saveState();
    
    logger.info(`Instance registered: ${this.instanceId} (PID: ${process.pid}, Port: ${this.httpPort}, Workspace: ${this.workspacePath})`);
  }

  /**
   * Unregisters this instance from coordination state
   */
  private async unregisterInstance(): Promise<void> {
    this.state.instances.delete(this.instanceId);
    
    // If this was the server, clear server reference
    if (this.state.serverInstance?.instanceId === this.instanceId) {
      this.state.serverInstance = undefined;
    }
    
    await this.saveState();
    logger.info(`Instance unregistered: ${this.instanceId}`);
  }

  /**
   * Starts the heartbeat mechanism
   */
  private startHeartbeat(): void {
    // For port-based coordination, minimize file-based monitoring
    // Clients monitor server health via WebSocket connection status
    
    if (this.currentRole === 'server-active') {
      // Only servers need heartbeat to maintain their registration
      this.heartbeatInterval = setInterval(async () => {
        try {
          // Update this server instance's last seen timestamp
          const instance = this.state.instances.get(this.instanceId);
          if (instance) {
            instance.lastSeen = Date.now();
            instance.role = this.currentRole;
            await this.saveState();
          }
          
          // Clean up stale instances
          await this.cleanupStaleInstances();
          
        } catch (error) {
          logger.error('Server heartbeat error:', error);
        }
      }, this.HEARTBEAT_INTERVAL);
    }
    // Clients don't need heartbeat - they monitor server via WebSocket
  }

  /**
   * Cleans up stale instances that haven't been seen recently
   */
  private async cleanupStaleInstances(): Promise<void> {
    const now = Date.now();
    let changed = false;
    
    for (const [instanceId, instance] of this.state.instances) {
      if (now - instance.lastSeen > this.INSTANCE_TIMEOUT) {
        logger.info(`Removing stale instance: ${instanceId}`);
        this.state.instances.delete(instanceId);
        
        // If the stale instance was the server, clear server reference
        if (this.state.serverInstance?.instanceId === instanceId) {
          this.state.serverInstance = undefined;
        }
        
        changed = true;
      }
    }
    
    if (changed) {
      await this.saveState();
    }
  }

  /**
   * Triggers an election to select a server instance
   */
  private async triggerElection(): Promise<void> {
    try {
      logger.info('Triggering instance election...');
      
      // Clear existing election timeout
      if (this.electionTimeout) {
        clearTimeout(this.electionTimeout);
      }
      
      // Reload state to get latest instances
      await this.loadState();
      
      // Ensure this instance is registered and up-to-date
      let thisInstance = this.state.instances.get(this.instanceId);
      if (!thisInstance) {
        // Re-register this instance if it's not in the state
        thisInstance = {
          instanceId: this.instanceId,
          role: this.currentRole,
          workspacePath: this.workspacePath,
          processId: process.pid,
          lastSeen: Date.now(),
          httpPort: this.httpPort
        };
        this.state.instances.set(this.instanceId, thisInstance);
        logger.info(`Re-registered instance during election: ${this.instanceId} (Port: ${this.httpPort})`);
      } else {
        thisInstance.lastSeen = Date.now();
        thisInstance.httpPort = this.httpPort;
        thisInstance.role = this.currentRole;
        logger.debug(`Updated instance during election: ${this.instanceId} (Port: ${this.httpPort})`);
      }
      
      // Find all eligible candidates for server role
      const now = Date.now();
      const candidates = Array.from(this.state.instances.values())
        .filter(instance => {
          const isAlive = (now - instance.lastSeen) < this.INSTANCE_TIMEOUT;
          const hasPort = instance.httpPort && instance.httpPort > 0;
          logger.info(`  Checking candidate ${instance.instanceId}: alive=${isAlive}, hasPort=${hasPort} (${instance.httpPort}), lastSeen=${now - instance.lastSeen}ms ago`);
          return isAlive && hasPort;
        })
        .sort((a, b) => {
          // Sort by process ID for deterministic election
          return a.processId - b.processId;
        });
      
      logger.info(`Election candidates found: ${candidates.length}`);
      candidates.forEach(c => logger.info(`  Candidate: ${c.instanceId} (PID: ${c.processId}, Port: ${c.httpPort})`));
      
      if (candidates.length === 0) {
        logger.warn('No eligible candidates for server role - this instance will remain inactive');
        this.currentRole = 'inactive';
        this.state.serverInstance = undefined;
        await this.saveState();
        this.emit('roleChanged', this.currentRole);
        
        // Schedule retry
        this.electionTimeout = setTimeout(() => {
          this.triggerElection();
        }, this.ELECTION_TIMEOUT);
        return;
      }
      
      // Select the first candidate (lowest PID) as server
      const serverCandidate = candidates[0];
      const previousRole = this.currentRole;
      
      // Update server instance in shared state
      this.state.serverInstance = serverCandidate;
      this.state.lastElection = Date.now();
      
      // Determine this instance's role
      if (serverCandidate.instanceId === this.instanceId) {
        this.currentRole = 'server-active';
        logger.info(`✓ Elected as SERVER: ${this.instanceId} (PID: ${serverCandidate.processId})`);
      } else {
        this.currentRole = 'client-active';
        logger.info(`✓ Elected as CLIENT: ${this.instanceId}, server is ${serverCandidate.instanceId} (PID: ${serverCandidate.processId})`);
      }
      
      // Update this instance's role in the shared state
      const thisInstanceUpdated = this.state.instances.get(this.instanceId);
      if (thisInstanceUpdated) {
        thisInstanceUpdated.role = this.currentRole;
        thisInstanceUpdated.lastSeen = Date.now();
      }
      
      await this.saveState();
      
      // Emit role change event if role changed
      if (previousRole !== this.currentRole) {
        logger.info(`Role changed: ${previousRole} → ${this.currentRole}`);
        this.emit('roleChanged', this.currentRole);
      }
      
      // Schedule next election check
      this.electionTimeout = setTimeout(() => {
        this.triggerElection();
      }, this.ELECTION_TIMEOUT);
      
    } catch (error) {
      logger.error('Election error:', error);
      this.currentRole = 'inactive';
      this.emit('roleChanged', this.currentRole);
      
      // Retry on error
      this.electionTimeout = setTimeout(() => {
        this.triggerElection();
      }, this.ELECTION_TIMEOUT);
    }
  }

  /**
   * Makes an HTTP request to another instance
   */
  private async makeHttpRequest(url: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      // http is now imported at the top
      const postData = JSON.stringify(data);
      
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      const req = http.request(url, options, (res: any) => {
        let responseData = '';
        
        res.on('data', (chunk: string) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(responseData);
            resolve(response);
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${responseData}`));
          }
        });
      });
      
      req.on('error', (error: Error) => {
        reject(error);
      });
      
      req.write(postData);
      req.end();
    });
  }
}



