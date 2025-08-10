# Technical Assumptions

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
