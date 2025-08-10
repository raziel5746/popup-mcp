# Requirements

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
