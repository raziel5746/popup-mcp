# Database Schema
Since no traditional database is required, we use VS Code's built-in storage (e.g., ExtensionContext.globalState) for configs. Below is a JSON schema representation for persisted data:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "extensionConfig": {
      "type": "object",
      "properties": {
        "chimeEnabled": { "type": "boolean" },
        "popupTimeout": { "type": "number" },
        "themePreference": { "type": "string" }
      }
    },
    "statusState": {
      "type": "string",
      "enum": ["server-active", "client-active", "disconnected", "error"]
    }
  },
  "additionalProperties": false
}
```

**Notes:** 
- No indexes/constraints beyond schema validation.
- For scalability, this handles local persistence; if needs grow (e.g., session data), migrate to SQLite.

