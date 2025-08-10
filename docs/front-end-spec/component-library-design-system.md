# Component Library / Design System

**Design System Approach:** Leverage VS Code's built-in design system (e.g., themes, icons, and UI patterns) as the foundation to ensure seamless integration and reduce development overhead. Extend with a minimal custom set of components for popup-specific needs, implemented in HTML/CSS/TypeScript. This hybrid approach prioritizes consistency with the editor while adding AI-flavored styling (e.g., subtle gradients or modern fonts) for distinction.

### Core Components

#### Popup Container

**Purpose:** Wrapper for the entire popup content in the tab, simulating a modal.

**Variants:** Single variant with buttons and an always-present "Custom text" button that toggles a resizable custom text area with Cancel and Send buttons.

**States:** Open (with chime), Loading (spinner for routing), Error (red border with message).

**Usage Guidelines:** Center in tab; auto-size to content; dismiss on response, escape key, or clicking the X button.

#### Action Button

**Purpose:** Customizable buttons for user responses.

**Variants:** None; all buttons use the same uniform styling.

**States:** Default, Hover, Disabled, Active (pressed).

**Usage Guidelines:** Use VS Code button styles; support any number of buttons; always include a "Custom text" button that toggles the text area (not controllable by AI).

#### Text Input Field

**Purpose:** Optional area for free-form user responses, toggled via the "Custom text" button.

**Variants:** None; always multiline and vertically resizable.

**States:** Empty, Focused, Validated (with error if needed).

**Usage Guidelines:** Hidden by default; toggled via button; include placeholder text; auto-focus on toggle.

#### Status Indicator

**Purpose:** Icon in status bar showing MCP state, clickable to display options like Connect/Disconnect/Restart Server/etc.

**Variants:** Server, Client, Disconnected.

**States:** Active (green), Warning (yellow), Error (red).

**Usage Guidelines:** Clickable for menu options; hover for tooltip with details.

#### Chime Toggle Button

**Purpose:** Separate button next to the Status Indicator for muting/unmuting the popup chime.

**Variants:** None.

**States:** Unmuted (e.g., bell icon), Muted (e.g., bell with strike-through (bell-slash)).

**Usage Guidelines:** Click to toggle state; hover shows text like "Popup MCP chime is ON" or "Popup MCP chime is OFF"; persists across sessions.
