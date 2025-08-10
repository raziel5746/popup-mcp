# Monitoring and Observability

## Monitoring Stack
- **Frontend Monitoring:** VS Code notifications for UI errors; track webview load times internally.
- **Backend Monitoring:** Console/output channel for MCP events; basic metrics like request count.
- **Error Tracking:** Built-in logging; optional extension telemetry if enabled (with consent).
- **Performance Monitoring:** VS Code profiler integration for extension runtime.

## Key Metrics
**Frontend Metrics:**
- Webview render time
- User interaction latency (e.g., button click to response)
- Error rates in popup handling

**Backend Metrics:**
- Request processing time
- Routing success rate
- Instance coordination events (e.g., elections)
