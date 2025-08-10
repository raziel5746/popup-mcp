# Wireframes & Mockups

**Primary Design Files:** Textual descriptions and wireframes in this document; recommend using free tools like draw.io for visual edits if needed.

### Key Screen Layouts

#### Popup Tab

**Purpose:** Display AI-triggered dialog for quick user responses in a tab simulating a modal.

**Key Elements:**
- Title bar with customizable text
- Message body for prompt details
- Action buttons (customizable labels)
- Optional text input field

**Interaction Notes:** Buttons trigger response routing and tab closure; keyboard navigation for accessibility; chime on open. The "Custom text" button toggles the custom text area, as well as the Cancel and Send buttons.

**Design File Reference:** Textual description; visualize as a centered card with header, content, and footer buttons. See screenshot: ![Popup Modal Screenshot](./images/modal-screenshot.png)

#### Status Bar Item

**Purpose:** Provide persistent visibility of MCP status and quick controls.

**Key Elements:**
- Icon indicating server/client role
- Hover text for detailed status
- Mute/unmute button for chime

**Interaction Notes:** Click to toggle mute; hover for info; updates in real-time.

**Design File Reference:** Textual description; standard VS Code status bar icon with tooltip.

#### Settings Panel

**Purpose:** Allow users to configure extension preferences.

**Key Elements:**
- Toggle for chime enable/disable
- Options for popup timeout and themes
- Save button

**Interaction Notes:** Changes apply immediately with confirmation; integrated with VS Code settings UI.

**Design File Reference:** Textual description; standard VS Code settings page section.
