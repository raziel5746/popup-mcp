# Epic 2: Multi-Instance Routing and Coordination

Expanded Goal: This epic builds on the foundation by adding multi-instance support, including workspace path detection for accurate popup routing and server/client coordination across VS Code windows. It ensures popups are directed to the correct instance based on AI-provided workspace paths, delivering reliable functionality in complex multi-project setups and enabling broader use cases without routing errors.

### Story 2.1: Implement Workspace Path Detection
As a developer, I want the extension to detect and register workspace paths using VS Code API, so that popups can be routed accurately in multi-instance environments.

#### Acceptance Criteria
1: Extension detects current workspace path on activation.
2: Registers path with MCP server for routing purposes.
3: Handles path changes (e.g., workspace switches) dynamically.
4: Testable with multiple mock instances.

### Story 2.2: Enable Server/Client Coordination
As the extension, I want to coordinate a single MCP server across multiple VS Code instances, with others acting as clients, so that there's unified handling of popup requests.

#### Acceptance Criteria
1: Elects one instance as server, others as clients via coordination mechanism.
2: Clients forward requests to the server if needed.
3: Status bar updates to reflect server/client role.
4: Graceful handling of server shutdown (e.g., elect new server).

### Story 2.3: Implement Accurate Popup Routing
As an AI assistant, I want popups to route to the correct VS Code instance based on included workspace path, so that interactions target the intended project.

#### Acceptance Criteria
1: Requires AI to include workspace path in popup data.
2: Routes request to matching instance using registered paths.
3: Falls back gracefully (e.g., error message) if no match found. (Consider enhancing with better UI for post-MVP improvements.)
4: End-to-end testing with multiple instances verifies routing accuracy.

### Story 2.4: Integrate Routing with Response Handling
As a user, I want responses from routed popups to return correctly to the AI, so that multi-instance interactions are seamless.

#### Acceptance Criteria
1: Responses from client instances route back through server to the correct AI using server-generated request ID.
2: Verifies full round-trip in multi-instance setup.
3: Includes logging for routing paths and any issues.
4: Ensures chime and UI elements work consistently across instances.

