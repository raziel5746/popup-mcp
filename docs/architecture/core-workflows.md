# Core Workflows
```mermaid
sequenceDiagram
    participant AI as AI Assistant
    participant MCP as MCP Server
    participant Router as Instance Router
    participant Popup as Popup Renderer
    participant User as User

    AI->>MCP: Send PopupRequest (JSON-RPC)
    MCP->>MCP: Generate requestId
    MCP->>Router: Route based on workspacePath
    Router->>Popup: Render popup in target instance
    activate Popup
    Popup->>User: Display popup (with chime if enabled)
    User->>Popup: Select button or enter text
    Popup->>MCP: Send PopupResponse
    deactivate Popup
    MCP->>AI: Return response (JSON-RPC via transport)
    alt Error (e.g., no match)
        Router->>MCP: Error notification
        MCP->>AI: JSON-RPC error
    end
```

This diagram focuses on the primary popup trigger workflow from PRD Epic 1, including routing and error path. Additional diagrams can be added for multi-instance or config flows if needed.
