# popup-mcp Product Requirements Document (PRD)

## Goals and Background Context

### Goals
- Enable AI coding assistants to trigger interactive popup dialogs in VS Code for structured user responses, reducing context switching.
- Provide accurate popup routing across multiple VS Code instances using workspace path detection.
- Support both HTTP and stdio protocols with zero-configuration setup.
- Enhance overall coding efficiency by transforming AIs into interactive pair programmers through button-based interactions.

### Background Context
In the current AI-assisted coding landscape, assistants like GitHub Copilot, Claude, Cursor, and Cline are confined to chat-based interactions, leading to workflow disruptions during critical decision-making moments. Developers experience cognitive overload from context switching to type responses, which can reduce efficiency by up to 40%. This extension addresses these issues by enabling popups that allow for quick, structured decisions without breaking focus.

The solution introduces an MCP server within VS Code that handles popup requests, routes them to the correct instance based on workspace paths, and captures button responses seamlessly. Popups will include customizable buttons and an option for free text input, allowing users to provide responses not covered by predefined options. This innovation positions AIs as true pair programmers, supporting use cases like architecture choices, deployment confirmations, and learning interactions, ultimately creating a more immersive coding experience.

### Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| [Current Date] | 1.0 | Initial draft of Goals and Background Context | John (PM Agent) |

## Requirements

### Functional
1. **FR1**: The extension shall allow AI assistants to trigger popup dialogs in VS Code with custom title, message, buttons, and optional free text input. Popups will be implemented using HTML, CSS, and TypeScript/JavaScript, displayed in a new VS Code tab to simulate a popup experience.
2. **FR2**: The extension shall capture user button selections or free text responses and route them back to the AI via MCP.
3. **FR3**: The system shall use workspace path detection to route popups to the correct VS Code instance in multi-instance scenarios. AI assistants shall include the workspace path (available in conversation metadata) when sending popup data to enable accurate mapping and routing.
4. **FR4**: The extension shall support both HTTP and stdio transports for MCP communication with zero user configuration.
5. **FR5**: A status bar indicator shall display the current connection state and server/client role.
6. **FR6**: The extension shall coordinate a single MCP server instance across multiple VS Code windows, with others acting as clients.
7. **FR7**: In cases of ambiguous routing, the system shall provide graceful degradation, such as error messages or fallback behaviors.
8. **FR8**: The extension shall play a chime sound when displaying a popup to notify the user, with options to mute/unmute via status bar button and extension settings.
9. **FR9**: Provide a command palette command to generate and copy the stdio MCP configuration JSON string, pointing to the installed extension's server file.

### Non Functional
1. **NFR1**: Popup display latency shall be under 50ms to ensure seamless user experience.
2. **NFR2**: The extension shall be compatible with VS Code versions 1.70 and above on Windows, macOS, and Linux.
3. **NFR3**: The extension shall adhere to VS Code extension security guidelines, ensuring no data collection without user consent.
4. **NFR4**: The system shall handle multi-instance coordination with minimal CPU and memory usage.
5. **NFR5**: The extension shall provide clear error handling and logging for debugging purposes.
6. **NFR6**: The system shall support multiple AI assistants in the same IDE instance by generating unique request IDs in the MCP server to route responses to the correct originator.

## User Interface Design Goals

### Overall UX Vision
The extension aims to provide a seamless, non-intrusive UI that integrates naturally with VS Code, minimizing disruption while enabling quick AI interactions via popups. Popups will be built using HTML, CSS, and TypeScript/JavaScript, displayed in a new VS Code tab rather than native modals. The focus is on low-friction, context-preserving decision-making that feels like a natural part of the editor experience, with safeguards against over-intrusiveness.

### Key Interaction Paradigms
- Modal popup dialogs for immediate, structured decisions with customizable buttons and free text input.
- Passive status bar indicator for MCP connection state without requiring user attention.
- Automatic server/client coordination with graceful handling of edge cases.
- Zero-configuration setup, leveraging VS Code APIs for workspace detection.
- User-configurable settings for popup behavior (e.g., frequency caps, auto-dismiss rules, theme integration) to prevent workflow disruptions.
- Configurable chime notification for popups, toggleable via status bar and settings.

### Core Screens and Views
- Popup Dialog: A modal window with title, message, action buttons, and optional text input field.
- Status Bar Item: A persistent icon indicator showing MCP role and connection status, with detailed text on hover; includes a mute/unmute button for popup chime.
- Settings Panel: Extension settings for customizing popup behaviors, preferences, and chime on/off option.

### Accessibility: WCAG AA
Standard accessibility compliance to ensure usability for a broad range of developers, including keyboard navigation, screen reader support for popups, and testing across diverse user setups.

### Branding
Implement a custom, modern, and minimalistic AI-looking style for popups to make them distinguishable from the rest of the IDE, while ensuring they do not clash with VS Code themes.

### Target Device and Platforms: Cross-Platform
VS Code desktop on Windows, macOS, and Linux, ensuring consistent experience across operating systems with platform-specific testing.

**Detailed Rationale:**
- **Trade-offs and Choices**: Opted for minimal UI elements to keep the extension lightweight, choosing popups over more complex interfaces to avoid overwhelming the user. Selected WCAG AA over AAA to balance accessibility with development effort for MVP, while adding configurable settings to mitigate intrusiveness risks.
- **Key Assumptions**: Assumed integration with VS Code's existing UI components will suffice; based on project brief's emphasis on desktop VS Code environments. Assumes early testing will validate multi-platform consistency.
- **Interesting Decisions**: Limited core views to popup, status bar, and settings to prioritize simplicity, with configurability added to address potential over-use; chose cross-platform without mobile support as VS Code is primarily desktop.
- **Areas Needing Validation**: Confirm if additional accessibility features are needed; custom themes or theme selection will be required in future versions but not for MVP; verify if status bar and configs are sufficient for all status information; conduct beta testing for intrusiveness and edge cases.

## Technical Assumptions

### Repository Structure: Monorepo
Single repository containing all code for the extension, including src/ for core logic, tests/, and package.json for packaging. Rationale: Simplifies development and dependency management for a focused VS Code extension project, aligning with MVP scope for quick iterations.

### Service Architecture
Single MCP server instance with client extensions for multi-instance coordination, built using Node.js. This monolith approach keeps everything self-contained within VS Code, avoiding distributed system complexities. Rationale: Matches the project's need for zero-configuration and low overhead; a monolith is sufficient for MVP as there's no need for scalable, independent services.

### Testing Requirements
Unit + Integration testing, focusing on core components like popup routing and MCP communication. Include manual testing for UI interactions. Rationale: Balances thoroughness with MVP timeline; unit tests cover logic, integration tests verify end-to-end flows, while full e2e might be overkill initially but can be added post-MVP.

### Additional Technical Assumptions and Requests
- **Languages/Frameworks**: TypeScript for frontend/UI using VS Code Extension API; Node.js for backend/server logic.
- **Database**: None required; use local storage if needed for configurations.
- **Hosting/Infrastructure**: Self-hosted within VS Code; no external servers.
- **Integration**: API hooks via HTTP/stdio; leverage VS Code API for workspace detection. AI assistants must include the workspace path when sending popup data for accurate routing. Requires configuration in AI assistant's MCP JSON file (e.g., for HTTP: {"popup-mcp": {"url": "http://localhost:3000/mcp", "type": "html"}}; for stdio: {"popup-mcp": {"command": "node", "args": ["path/to/extension/dist/index.js"]}}).
- **Security**: No data collection without consent; follow VS Code guidelines.
- **Performance**: Low latency (under 50ms for popups) with minimal resource usage.

**Detailed Rationale:**
- **Trade-offs and Choices**: Chose monorepo over polyrepo for simplicity in a small project, trading potential modularity for easier maintenance. Opted for monolith architecture instead of microservices to minimize complexity and deployment overhead, suitable for an extension without scaling needs.
- **Key Assumptions**: Based on project brief's preferences; assumes VS Code API stability and no major changes. For unknowns, guided by MVP scope emphasizing lightweight, cross-platform compatibility.
- **Interesting Decisions**: Limited testing to unit + integration to accelerate development, potentially risking undetected UI bugs—mitigated by manual checks. No database keeps things simple, assuming configs can be handled locally.
- **Areas Needing Validation**: Confirm if additional libraries (e.g., for HTTP handling) are needed; verify performance across OSes; check if security assumptions cover all popup data scenarios.

## Epic List

1. **Epic 1: Foundation and Core Popup Functionality** - Establish the extension skeleton, MCP server setup, basic popup display (using HTML/CSS/TS in a tab), chime notification, and simple button response routing to deliver an initial working prototype for single-instance use.

2. **Epic 2: Multi-Instance Routing and Coordination** - Implement workspace path detection, server/client coordination across multiple VS Code instances, and accurate popup routing (requiring AI to include workspace path) to enable reliable interactions in complex setups.

3. **Epic 3: UI Enhancements and Polish** - Add configurable settings for popups (e.g., chime mute, themes), status bar indicators with hover details and mute button, accessibility features, and full integration testing to complete the MVP with a polished user experience.

## Epic 1: Foundation and Core Popup Functionality

Expanded Goal: This epic sets up the basic infrastructure for the Popup MCP extension, including the MCP server, core popup display in a new tab using HTML/CSS/TypeScript, chime notification, and basic response handling. It delivers a functional single-instance prototype that allows AI assistants to trigger and receive responses from popups, providing immediate value for testing and basic use cases while establishing the foundation for subsequent epics.

### Story 1.1: Set Up Extension Skeleton and MCP Server
As a developer, I want to create the basic VS Code extension structure with an integrated MCP server, so that it can handle incoming popup requests via HTTP/stdio.

#### Acceptance Criteria
1: Extension activates and initializes MCP server on VS Code startup.
2: Supports both HTTP and stdio transports with zero configuration.
3: Basic health-check endpoint or command to verify server is running.
4: Logs server initialization and any errors appropriately.

### Story 1.2: Implement Basic Popup Display
As a user, I want popups to display in a new VS Code tab with custom title, message, buttons, and free text input, so that I can interact with AI-triggered dialogs.

#### Acceptance Criteria
1: Popup renders as HTML/CSS/TS in a new tab simulating a modal.
2: Displays provided title, message, buttons, and optional text field.
3: Applies custom modern minimalistic AI style without clashing with VS Code themes.
4: Plays a provided WAV file as chime sound on display (if not muted).
5: Local testability via command or sample request.
6: Displays the workspace path in the popup for debugging purposes.

### Story 1.3: Handle User Responses and Routing
As an AI assistant, I want to receive user button clicks or text responses back via MCP, so that interactions are complete and seamless.

#### Acceptance Criteria
1: Captures button selection or text input and sends response via MCP.
2: Closes the popup tab after response submission.
3: Handles errors gracefully with user notifications.
4: Verifies response routing in single-instance setup.

### Story 1.4: Add Status Bar Indicator
As a user, I want a status bar icon showing MCP status with hover details and chime mute button, so that I can monitor and control the extension easily.

#### Acceptance Criteria
1: Displays icon for MCP role and connection status.
2: Hover shows detailed text information.
3: Includes button to toggle chime mute/unmute.
4: Persists across sessions via local storage if needed.

## Epic 2: Multi-Instance Routing and Coordination

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
3: Falls back gracefully (e.g., error message) if no match found.
4: End-to-end testing with multiple instances verifies routing accuracy.

### Story 2.4: Integrate Routing with Response Handling
As a user, I want responses from routed popups to return correctly to the AI, so that multi-instance interactions are seamless.

#### Acceptance Criteria
1: Responses from client instances route back through server to the correct AI using server-generated request ID.
2: Verifies full round-trip in multi-instance setup.
3: Includes logging for routing paths and any issues.
4: Ensures chime and UI elements work consistently across instances.

## Epic 3: UI Enhancements and Polish

Expanded Goal: This final epic enhances the user interface with configurable settings, accessibility features, and thorough testing to polish the extension. It completes the MVP by adding user controls for popups (like chime muting and basic themes), ensuring WCAG AA compliance, and validating the full system through integration testing, resulting in a robust, user-friendly product ready for release.

### Story 3.1: Implement Configurable Settings
As a user, I want extension settings for customizing popup behaviors, including chime on/off, frequency caps, and auto-dismiss rules, so that I can tailor the experience to my needs.

#### Acceptance Criteria
1: Adds settings panel with options for chime toggle, popup limits, and other behaviors.
2: Settings persist and apply immediately.
3: Integrates with status bar mute button for chime.
4: Documents settings in README or help command.

### Story 3.2: Enhance Accessibility Features
As a user with accessibility needs, I want the popup to meet WCAG AA standards, including keyboard navigation, screen reader support, and high-contrast modes, so that the extension is inclusive.

#### Acceptance Criteria
1: Implements keyboard navigation for buttons and text input.
2: Ensures screen reader compatibility (e.g., ARIA labels).
3: Tests with high-contrast themes and diverse setups.
4: Validates against WCAG AA checklist.

### Story 3.3: Add Theme Integration and Polish
As a user, I want popups to integrate with VS Code themes while maintaining a distinct AI style, with options for future custom themes, so that the UI feels cohesive yet noticeable.

#### Acceptance Criteria
1: Syncs popup style with VS Code themes without clashes.
2: Applies modern minimalistic AI look as specified.
3: Prepares hooks for future theme selection (not implemented in MVP).
4: Visual testing across OSes and themes.

### Story 3.4: Conduct Full Integration Testing and Polish
As a developer, I want comprehensive integration tests covering all features, including multi-instance scenarios, chime, routing, and configs, so that the MVP is stable and ready for release.

#### Acceptance Criteria
1: Writes integration tests for end-to-end flows.
2: Includes manual testing for UI interactions and edge cases.
3: Fixes any discovered bugs and polishes UX based on testing.
4: Achieves 95% popup success rate in tests.

## Checklist Results Report

### Executive Summary
- **Overall PRD Completeness**: 92% - The document is comprehensive, well-structured, and covers most essential elements with clear requirements and epics.
- **MVP Scope Appropriateness**: Just Right - The scope is minimal yet viable, focused on core functionality with logical incremental epics that deliver value without overreach.
- **Readiness for Architecture Phase**: Ready - The PRD provides sufficient detail and constraints for the architect to proceed, with minor gaps in validation areas that can be addressed during design.
- **Most Critical Gaps or Concerns**: Limited coverage of data requirements (no data entities needed, but could specify if any local storage is used); some non-functional requirements could be more quantifiable (e.g., exact resource limits).

### Category Analysis Table

| Category                         | Status  | Critical Issues |
| -------------------------------- | ------- | --------------- |
| 1. Problem Definition & Context  | PASS    | None - Strong problem statement and goals aligned with brief. |
| 2. MVP Scope Definition          | PASS    | None - Clear boundaries and validation criteria. |
| 3. User Experience Requirements  | PASS    | None - Detailed UX vision with rationale. |
| 4. Functional Requirements       | PASS    | Minor: Some ACs could include more testability details. |
| 5. Non-Functional Requirements   | PARTIAL | Performance metrics good, but security could specify threat models. |
| 6. Epic & Story Structure        | PASS    | None - Well-sequenced with vertical slices. |
| 7. Technical Guidance            | PASS    | None - Clear assumptions and rationale. |
| 8. Cross-Functional Requirements | PARTIAL | Data section minimal (appropriate for project); integrations well-covered. |
| 9. Clarity & Communication       | PASS    | None - Consistent, well-organized document. |

### Top Issues by Priority
- **BLOCKERS**: None identified - PRD is actionable.
- **HIGH**: Enhance non-functional requirements with more specific metrics (e.g., exact CPU/memory thresholds for NFR4).
- **MEDIUM**: Add explicit data entity definitions if local storage expands (currently none, but for future-proofing).
- **LOW**: Include diagrams for user flows in UX section for better visualization.

### MVP Scope Assessment
- **Features that Might Be Cut**: None essential— all tie to core value; if needed, defer advanced config options to post-MVP.
- **Missing Features**: Basic analytics for popup usage (out of scope, as per brief).
- **Complexity Concerns**: Multi-instance routing (Epic 2) may have edge cases; testing story in Epic 3 mitigates.
- **Timeline Realism**: With small stories, achievable in 3 months assuming part-time effort.

### Technical Readiness
- **Clarity of Technical Constraints**: High - Monorepo, monolith, languages specified clearly.
- **Identified Technical Risks**: VS Code API changes, multi-instance edge cases—flagged for validation.
- **Areas Needing Architect Investigation**: Detailed routing mechanism, chime implementation (WAV playback), and ID generation for multi-AI support.

### Recommendations
- **Actions for Blockers**: N/A.
- **Suggested Improvements**: Quantify NFRs further; add a simple data model if storage needs grow.
- **Next Steps**: Proceed to architecture phase; review with stakeholders for final alignment.

## Next Steps

### UX Expert Prompt
@ux.md Create a UX design for the Popup MCP extension based on the attached PRD (docs/prd.md), focusing on wireframes for the popup tab, status bar, and settings panel, ensuring WCAG AA accessibility and modern AI styling.

### Architect Prompt
@architect.md Create the technical architecture for the Popup MCP extension using the attached PRD (docs/prd.md) as input, including component diagrams, tech stack details, and implementation plan aligned with the epics.
