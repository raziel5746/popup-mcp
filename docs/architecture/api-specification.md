# API Specification

## MCP Protocol Specification
The API uses a custom MCP protocol supporting HTTP and stdio transports, following JSON-RPC over these channels as per MCP spec. For HTTP: Single endpoint with POST for requests and GET for SSE streaming responses. For stdio: JSON messages delimited by newlines. Interactions are request-response, with server-generated id for tracking (using JSON-RPC 'id').

**Request Schema (Incoming from AI, as JSON-RPC)**
```yaml
type: object
properties:
  jsonrpc:
    type: string
    const: "2.0"
  method:
    type: string
    description: e.g., "triggerPopup"
  params:
    type: object
    properties:
      workspacePath:
        type: string
      title:
        type: string
      message:
        type: string
      options:
        type: array
        items:
          type: object
          properties:
            label:
              type: string
            value:
              type: string
  id:
    type: string
required:
  - jsonrpc
  - method
  - params
  - id
```

**Response Schema (Outgoing to AI, as JSON-RPC)**
```yaml
type: object
properties:
  jsonrpc:
    type: string
    const: "2.0"
  result:
    type: object
    properties:
      selectedValue:
        type: string
  id:
    type: string
  error:
    type: object  # If error
required:
  - jsonrpc
  - id
```

**HTTP Endpoint**
- **POST /mcp** - Triggers a popup via JSON-RPC request.
  - Authentication: None (local, per security recs: validate Origin, bind localhost).
  - Example Request:
    ```json
    {
      "jsonrpc": "2.0",
      "method": "triggerPopup",
      "params": {
        "workspacePath": "/path/to/workspace",
        "title": "Confirm Action",
        "message": "Deploy now?",
        "options": [{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]
      },
      "id": "req1"
    }
    ```
  - Example Acknowledgment (202 Accepted for init, full response via SSE):
    ```json
    {
      "jsonrpc": "2.0",
      "result": {"status": "queued"},
      "id": "req1"
    }
    ```
  - Full Response (via SSE event or JSON):
    ```json
    {
      "jsonrpc": "2.0",
      "result": {"selectedValue": "yes"},
      "id": "req1"
    }
    ```
- **GET /mcp** - SSE stream for server messages/responses.

**Stdio Format**
- Messages as JSON-RPC lines over stdio.
- Example Input: `{"jsonrpc":"2.0","method":"triggerPopup","params":{"workspacePath":"/path/to/workspace","title":"Confirm","message":"Proceed?","options":[{"label":"Yes","value":"yes"}]},"id":"req1"}`  
- Example Output: `{"jsonrpc":"2.0","result":{"selectedValue":"yes"},"id":"req1"}`

**Integration Notes**
- Error Handling: JSON-RPC error objects; HTTP codes (e.g., 400 for invalid).
- Security: Bind localhost, validate Origin; no external exposure.
