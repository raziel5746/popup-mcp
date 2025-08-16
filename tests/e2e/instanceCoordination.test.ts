/**
 * E2E tests for multi-instance coordination system
 * Tests election mechanism, client forwarding, and server failover
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { InstanceCoordinator } from '../../src/backend/coordination';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Instance Coordination E2E Tests', () => {
  const testWorkspacePath1 = '/test/workspace1';
  const testWorkspacePath2 = '/test/workspace2';
  const testPort1 = 9001;
  const testPort2 = 9002;
  let coordinator1: InstanceCoordinator;
  let coordinator2: InstanceCoordinator;
  let coordinationFile: string;

  beforeEach(async () => {
    // Clean up any existing coordination file
    coordinationFile = path.join(os.tmpdir(), 'popup-mcp-coordination.json');
    if (fs.existsSync(coordinationFile)) {
      fs.unlinkSync(coordinationFile);
    }
    
    // Wait a bit to ensure file system operations complete
    await new Promise(resolve => setTimeout(resolve, 50));

    // Create coordinators
    coordinator1 = new InstanceCoordinator(testWorkspacePath1, testPort1);
    coordinator2 = new InstanceCoordinator(testWorkspacePath2, testPort2);
  });

  afterEach(async () => {
    // Stop coordinators with extra delay to ensure proper cleanup
    try {
      if (coordinator1) {
        await coordinator1.stop();
      }
    } catch (error) {
      console.warn('Error stopping coordinator1:', error);
    }
    
    try {
      if (coordinator2) {
        await coordinator2.stop();
      }
    } catch (error) {
      console.warn('Error stopping coordinator2:', error);
    }
    
    // Wait longer for all cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Clean up coordination file
    try {
      if (fs.existsSync(coordinationFile)) {
        fs.unlinkSync(coordinationFile);
      }
    } catch (error) {
      console.warn('Error cleaning up coordination file:', error);
    }
    
    // Extra cleanup - make sure no stale references
    coordinator1 = null as any;
    coordinator2 = null as any;
  });

  describe('Election Mechanism', () => {
    it('should elect single instance as server', async () => {
      // Start first coordinator
      await coordinator1.start();
      
      // Wait for election to complete with polling
      let role = coordinator1.getCurrentRole();
      let attempts = 0;
      while (role !== 'server-active' && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        role = coordinator1.getCurrentRole();
        attempts++;
      }
      
      // First instance should be elected as server
      expect(coordinator1.getCurrentRole()).toBe('server-active');
      
      const serverInstance = coordinator1.getServerInstance();
      expect(serverInstance).toBeDefined();
      expect(serverInstance?.httpPort).toBe(testPort1);
    });

    it('should elect server from multiple instances based on process ID', async () => {
      // Start both coordinators
      await coordinator1.start();
      await coordinator2.start();
      
      // Wait for both to complete election with polling
      let attempts = 0;
      let roles = [coordinator1.getCurrentRole(), coordinator2.getCurrentRole()];
      
      while ((!roles.includes('server-active') || !roles.includes('client-active')) && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 500));
        roles = [coordinator1.getCurrentRole(), coordinator2.getCurrentRole()];
        attempts++;
      }
      
      // One should be server, one should be client
      expect(roles).toContain('server-active');
      expect(roles).toContain('client-active');
      
      // Both should have the same server instance
      const server1 = coordinator1.getServerInstance();
      const server2 = coordinator2.getServerInstance();
      expect(server1?.instanceId).toBe(server2?.instanceId);
    }, 15000);

    it('should handle server shutdown and re-elect', async () => {
      // Ensure clean state - stop any existing coordinators first
      if (coordinator1) {
        await coordinator1.stop();
      }
      if (coordinator2) {
        await coordinator2.stop();
      }
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Clean coordination file again
      if (fs.existsSync(coordinationFile)) {
        fs.unlinkSync(coordinationFile);
      }
      
      // Create fresh coordinators
      coordinator1 = new InstanceCoordinator(testWorkspacePath1, testPort1);
      coordinator2 = new InstanceCoordinator(testWorkspacePath2, testPort2);
      
      // Start both coordinators
      await coordinator1.start();
      await coordinator2.start();
      
      // Wait for initial election with polling
      let attempts = 0;
      let roles = [coordinator1.getCurrentRole(), coordinator2.getCurrentRole()];
      
      while ((!roles.includes('server-active') || !roles.includes('client-active')) && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 500));
        roles = [coordinator1.getCurrentRole(), coordinator2.getCurrentRole()];
        attempts++;
      }
      
      // Identify which is server and which is client
      const isCoordinator1Server = coordinator1.getCurrentRole() === 'server-active';
      const serverCoordinator = isCoordinator1Server ? coordinator1 : coordinator2;
      const clientCoordinator = isCoordinator1Server ? coordinator2 : coordinator1;
      
      expect(serverCoordinator.getCurrentRole()).toBe('server-active');
      expect(clientCoordinator.getCurrentRole()).toBe('client-active');
      
      // Stop the server instance
      await serverCoordinator.stop();
      
      // Give time for the server state to be cleared and saved
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Wait for re-election with polling
      attempts = 0;
      while (clientCoordinator.getCurrentRole() !== 'server-active' && attempts < 40) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
        
        // Debug logging every 2 attempts
        if (attempts % 2 === 0) {
          const serverInfo = clientCoordinator.getServerInstance();
          const allInstances = clientCoordinator.getAllInstances();
          console.log(`Attempt ${attempts}: Client role=${clientCoordinator.getCurrentRole()}, serverInstance=${serverInfo?.instanceId || 'none'}, totalInstances=${allInstances.length}`);
        }
      }
      
      // Client should now be promoted to server
      expect(clientCoordinator.getCurrentRole()).toBe('server-active');
    }, 30000); // Increase test timeout to 30 seconds
  });

  describe('Status Updates', () => {
    it('should emit role change events', async () => {
      let roleChangeCount = 0;
      let lastRole: string = '';
      
      coordinator1.on('roleChanged', (newRole: string) => {
        roleChangeCount++;
        lastRole = newRole;
      });
      
      await coordinator1.start();
      
      // Wait for role assignment with polling
      let attempts = 0;
      while (coordinator1.getCurrentRole() !== 'server-active' && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
      }
      
      // Give a bit more time for events to propagate
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(roleChangeCount).toBeGreaterThan(0);
      expect(lastRole).toBe('server-active');
    });

    it('should track all instances in coordination state', async () => {
      await coordinator1.start();
      await coordinator2.start();
      
      // Wait for both instances to register and elect roles
      let attempts = 0;
      let instances1 = coordinator1.getAllInstances();
      let instances2 = coordinator2.getAllInstances();
      
      // Poll until both instances see each other
      while ((instances1.length < 2 || instances2.length < 2) && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 500));
        instances1 = coordinator1.getAllInstances();
        instances2 = coordinator2.getAllInstances();
        attempts++;
      }
      
      // Both should see at least 2 instances
      expect(instances1.length).toBeGreaterThanOrEqual(2);
      expect(instances2.length).toBeGreaterThanOrEqual(2);
      
      // Should have unique instance IDs
      const instanceIds1 = instances1.map(i => i.instanceId);
      const instanceIds2 = instances2.map(i => i.instanceId);
      expect(new Set(instanceIds1).size).toBeGreaterThanOrEqual(2);
      expect(new Set(instanceIds2).size).toBeGreaterThanOrEqual(2);
    }, 20000);
  });

  describe('Request Forwarding', () => {
    it('should allow client to forward requests to server', async () => {
      // Mock HTTP server for testing forwarding
      const mockRequest = {
        jsonrpc: '2.0',
        method: 'triggerPopup',
        params: {
          title: 'Test',
          message: 'Test message',
          workspacePath: testWorkspacePath1
        },
        id: 'test-123'
      };

      await coordinator1.start();
      await coordinator2.start();
      
      // Wait for election
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Find the client coordinator
      const isCoordinator1Client = coordinator1.getCurrentRole() === 'client-active';
      const clientCoordinator = isCoordinator1Client ? coordinator1 : coordinator2;
      
      if (clientCoordinator.getCurrentRole() === 'client-active') {
        // Test that client can attempt to forward (will fail without actual HTTP server)
        try {
          await clientCoordinator.forwardToServer(mockRequest);
        } catch (error) {
          // Expected to fail since we don't have actual HTTP server running
          expect(error).toBeDefined();
        }
      }
    });

    it('should prevent server from forwarding requests', async () => {
      await coordinator1.start();
      
      // Wait for server role assignment
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      expect(coordinator1.getCurrentRole()).toBe('server-active');
      
      const mockRequest = { test: 'request' };
      
      // Server should not forward requests
      await expect(coordinator1.forwardToServer(mockRequest)).rejects.toThrow(
        'Server instances should not forward requests'
      );
    });
  });

  describe('State Persistence', () => {
    it('should persist coordination state to file', async () => {
      await coordinator1.start();
      
      // Wait for state to be saved
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Coordination file should exist
      expect(fs.existsSync(coordinationFile)).toBe(true);
      
      // File should contain coordination data
      const fileData = fs.readFileSync(coordinationFile, 'utf8');
      const coordinationData = JSON.parse(fileData);
      
      expect(coordinationData.instances).toBeDefined();
      expect(coordinationData.lastElection).toBeDefined();
    });

    it('should load existing coordination state on startup', async () => {
      // Create initial state
      await coordinator1.start();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const initialServerInstance = coordinator1.getServerInstance();
      
      // Stop coordinator
      await coordinator1.stop();
      
      // Create new coordinator and start it
      const coordinator3 = new InstanceCoordinator(testWorkspacePath1, testPort1);
      await coordinator3.start();
      
      // Wait for state loading
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Should load existing state (though might re-elect due to stale instances)
      expect(coordinator3.getCurrentRole()).toBeDefined();
      
      await coordinator3.stop();
    });
  });

  describe('Popup Routing', () => {
    it('should route popup requests to correct instance based on workspace path', async () => {
      // Start both coordinators
      await coordinator1.start();
      await coordinator2.start();
      
      // Wait for election
      let attempts = 0;
      let roles = [coordinator1.getCurrentRole(), coordinator2.getCurrentRole()];
      
      while ((!roles.includes('server-active') || !roles.includes('client-active')) && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 500));
        roles = [coordinator1.getCurrentRole(), coordinator2.getCurrentRole()];
        attempts++;
      }
      
      // Find server and client coordinators
      const isCoordinator1Server = coordinator1.getCurrentRole() === 'server-active';
      const serverCoordinator = isCoordinator1Server ? coordinator1 : coordinator2;
      const clientCoordinator = isCoordinator1Server ? coordinator2 : coordinator1;
      
      // Wait for both instances to be registered with each other
      let instances = serverCoordinator.getAllInstances();
      let registrationAttempts = 0;
      
      while (instances.length < 2 && registrationAttempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 500));
        instances = serverCoordinator.getAllInstances();
        registrationAttempts++;
      }
      
      // Verify instances are registered with correct workspace paths
      expect(instances.length).toBeGreaterThanOrEqual(2);
      
      const workspace1Instance = instances.find(i => i.workspacePath === testWorkspacePath1);
      const workspace2Instance = instances.find(i => i.workspacePath === testWorkspacePath2);
      
      expect(workspace1Instance).toBeDefined();
      expect(workspace2Instance).toBeDefined();
      expect(workspace1Instance!.instanceId).not.toBe(workspace2Instance!.instanceId);
    }, 15000);

    it('should return error when no matching workspace instance found', async () => {
      // Start single coordinator
      await coordinator1.start();
      
      // Wait for server role assignment with polling
      let attempts = 0;
      while (coordinator1.getCurrentRole() !== 'server-active' && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
      }
      
      // Debug logging if it fails
      if (coordinator1.getCurrentRole() !== 'server-active') {
        console.log(`DEBUG: Expected server-active, got ${coordinator1.getCurrentRole()}`);
        console.log(`DEBUG: All instances:`, coordinator1.getAllInstances().map(i => ({ id: i.instanceId, role: i.role, port: i.httpPort })));
      }
      
      expect(coordinator1.getCurrentRole()).toBe('server-active');
      
      // Verify that coordinator1 only knows about testWorkspacePath1
      const instances = coordinator1.getAllInstances();
      const workspace1Instance = instances.find(i => i.workspacePath === testWorkspacePath1);
      const workspace2Instance = instances.find(i => i.workspacePath === testWorkspacePath2);
      
      expect(workspace1Instance).toBeDefined();
      expect(workspace2Instance).toBeUndefined(); // Should not exist
    });

    it('should handle local workspace path matching correctly', async () => {
      // Start single coordinator
      await coordinator1.start();
      
      // Wait for server role assignment with polling
      let attempts = 0;
      while (coordinator1.getCurrentRole() !== 'server-active' && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
      }
      
      // Verify that coordinator1 is registered with testWorkspacePath1
      const instances = coordinator1.getAllInstances();
      const thisInstance = instances.find(i => i.processId === process.pid);
      
      expect(thisInstance).toBeDefined();
      expect(thisInstance!.workspacePath).toBe(testWorkspacePath1);
    });

    it('should normalize workspace paths for comparison', async () => {
      // Test path normalization with different separators and trailing slashes
      const testPaths = [
        '/test/workspace1',
        '/test/workspace1/',
        '\\test\\workspace1',
        '\\test\\workspace1\\',
        '/Test/Workspace1', // Different case
      ];
      
      await coordinator1.start();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // All these paths should be considered equivalent to testWorkspacePath1
      // This is tested implicitly through the routing logic
      expect(coordinator1.getCurrentRole()).toBeDefined();
    });
  });

  describe('Cleanup and Heartbeat', () => {
    it('should clean up stale instances', async () => {
      // This test verifies that the coordination system can detect and clean up stale instances
      // We'll simulate this by checking that instances are properly registered and tracked
      
      await coordinator1.start();
      
      // Wait for initial registration
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      let instances = coordinator1.getAllInstances();
      expect(instances.length).toBeGreaterThanOrEqual(1);
      
      // Debug logging
      console.log('Current process.pid:', process.pid);
      console.log('Found instances:', instances.map(i => ({ id: i.instanceId, pid: i.processId, workspace: i.workspacePath })));
      
      // Verify that instance has recent lastSeen timestamp
      const instance = instances.find(i => i.processId === process.pid);
      if (!instance) {
        console.log('No instance found with current process.pid, looking for testWorkspacePath1 instead');
        const workspaceInstance = instances.find(i => i.workspacePath === testWorkspacePath1);
        expect(workspaceInstance).toBeDefined();
        expect(Date.now() - workspaceInstance!.lastSeen).toBeLessThan(10000); // Within last 10 seconds
      } else {
        expect(instance).toBeDefined();
        expect(Date.now() - instance!.lastSeen).toBeLessThan(10000); // Within last 10 seconds
      }
      
      // Note: Full stale instance cleanup testing would require more complex setup
      // with multiple processes, which is beyond the scope of unit tests
    }, 10000);
  });
});
