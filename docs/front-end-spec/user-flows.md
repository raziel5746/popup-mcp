# User Flows

### Popup Interaction Flow

**User Goal:** Provide a quick, structured response to an AI-triggered query without disrupting coding workflow.

**Entry Points:** AI assistant sends popup request via MCP (HTTP or stdio).

**Success Criteria:** User selects button or enters text, response is routed back to AI, popup tab closes automatically.

#### Flow Diagram

```mermaid
graph TD
    A[AI Triggers Popup] --> B[Route to Correct Instance]
    B --> C[Display Popup Tab with Chime]
    C --> D[User Reads Message]
    D --> E{Interaction Type?}
    E -->|Button Click| F[Capture Selection]
    E -->|Text Input| G[Capture Text]
    F --> H[Send Response via MCP]
    G --> H
    H --> I[Close Popup Tab]
    I --> J[Return to Coding]
```

#### Edge Cases & Error Handling:
- Ambiguous routing: Display error in status bar and fallback to first instance.
- No user response: Auto-dismiss after configurable timeout with default response.
- Muted chime: Visual notification only via status bar flash.
- Accessibility mode: Ensure keyboard-only navigation with screen reader announcements.

**Notes:** Flow emphasizes minimal steps (1-2 interactions) to reduce cognitive load; integrates with VS Code tabs for familiarity.

### Settings Configuration Flow

**User Goal:** Customize extension behaviors like chime settings or popup preferences.

**Entry Points:** Via VS Code settings panel or command palette.

**Success Criteria:** Changes saved and applied immediately, with confirmation message.

#### Flow Diagram

```mermaid
graph TD
    A[Open Settings] --> B[Navigate to Extension Section]
    B --> C[Modify Preferences e.g., Chime Toggle]
    C --> D[Save Changes]
    D --> E[Apply Updates]
    E --> F[Display Confirmation]
```

#### Edge Cases & Error Handling:
- Invalid input: Real-time validation with error tooltips.
- Conflicts with VS Code settings: Prioritize extension defaults with warnings.

**Notes:** Simple flow leveraging VS Code's built-in settings UI for consistency.
