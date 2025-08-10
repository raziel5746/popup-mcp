# Epic 1: Foundation and Core Popup Functionality

Expanded Goal: This epic sets up the basic infrastructure for the Popup MCP extension, including the MCP server, core popup display in a new tab using HTML/CSS/TypeScript, chime notification, and basic response handling. It delivers a functional single-instance prototype that allows AI assistants to trigger and receive responses from popups, providing immediate value for testing and basic use cases while establishing the foundation for subsequent epics.

### Story 1.1: Implement Repository Setup and Initial Commit Processes
As a developer, I want clear steps for repository initialization, including git setup, initial commit, and basic README, so that the project starts with proper version control and documentation.

#### Acceptance Criteria
1: Define git init, .gitignore, and initial commit in extension setup.
2: Include basic README with setup instructions.
3: Integrate with Story 1.3 for seamless scaffolding.

### Story 1.2: Create Detailed Development Environment Guide
As a developer, I want a comprehensive guide for setting up the local dev environment, including tools, versions, and dependencies, so that onboarding is smooth and consistent.

#### Acceptance Criteria
1: Document required tools (e.g., Node.js, vsce) with versions.
2: Step-by-step install and config instructions in README or docs.
3: Verify against NFR2 (VS Code 1.70+ compatibility).

### Story 1.3: Set Up Extension Skeleton and MCP Server
As a developer, I want to create the basic VS Code extension structure with an integrated MCP server, so that it can handle incoming popup requests via HTTP/stdio.

#### Acceptance Criteria
1: Extension activates and initializes MCP server on VS Code startup.
2: Supports both HTTP and stdio transports with zero configuration.
3: Basic health-check endpoint or command to verify server is running.
4: Logs server initialization and any errors appropriately.

### Story 1.4: Implement Basic Popup Display
As a user, I want popups to display in a new VS Code tab with custom title, message, buttons, and free text input, so that I can interact with AI-triggered dialogs.

#### Acceptance Criteria
1: Popup renders as HTML/CSS/TS in a new tab simulating a modal.
2: Displays provided title, message, buttons, and optional text field.
3: Applies custom modern minimalistic AI style without clashing with VS Code themes.
4: Plays a provided WAV file as chime sound on display (if not muted).
5: Local testability via command or sample request.
6: Displays the workspace path in the popup for debugging purposes.

### Story 1.5: Handle User Responses and Routing
As an AI assistant, I want to receive user button clicks or text responses back via MCP, so that interactions are complete and seamless.

#### Acceptance Criteria
1: Captures button selection or text input and sends response via MCP.
2: Closes the popup tab after response submission.
3: Handles errors gracefully with user notifications.
4: Verifies response routing in single-instance setup.

### Story 1.6: Add Status Bar Indicator
As a user, I want a status bar icon showing MCP status with hover details and chime mute button, so that I can monitor and control the extension easily.

#### Acceptance Criteria
1: Displays icon for MCP role and connection status.
2: Hover shows detailed text information.
3: Includes button to toggle chime mute/unmute.
4: Persists across sessions via local storage if needed.

