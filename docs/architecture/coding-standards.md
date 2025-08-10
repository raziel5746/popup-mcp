# Coding Standards

## Critical Fullstack Rules
- **Type Safety**: Always use explicit types/interfaces from shared/types/; no 'any' unless unavoidable with comment.
- **Error Handling**: Wrap async operations in try/catch; use custom Error classes for MCP errors; log to VS Code output channel.
- **API Calls**: Validate all incoming MCP requests with schemas before processing; never assume valid input.
- **Environment Access**: Load env vars via a config service, not direct process.env, for testability.
- **Extension Lifecycle**: Use activation/deactivation events properly; clean up resources (e.g., dispose webviews) on deactivate.
- **Performance**: Avoid synchronous ops in main thread; use async/await for I/O (e.g., file access).

## Naming Conventions
| Element | Frontend | Backend | Example |
|---------|----------|---------|---------|
| Classes/Components | PascalCase | PascalCase | `PopupWebview.ts` |
| Functions/Methods | camelCase | camelCase | `handleRequest()` |
| Variables | camelCase | camelCase | `requestId` |
| Constants | UPPER_CASE | UPPER_CASE | `MCP_PORT` |
| Files | kebab-case | kebab-case | `mcp-server.ts` |
| Commands | extension.prefix.camelCase | N/A | `popupmcp.copyMcpJson` |
