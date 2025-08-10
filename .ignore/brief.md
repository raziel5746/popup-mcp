# Project Brief: Popup MCP

## Executive Summary

The Popup MCP extension for VS Code bridges the gap between AI coding assistants (like GitHub Copilot, Claude, Cursor, and Cline) and the editor's UI by enabling interactive popup dialogs with custom titles, messages, and buttons for structured user responses. It addresses the current limitation where AIs can only communicate via chat, disrupting workflows during decision-making moments—such as code reviews, deployments, or debugging—by requiring typed responses that break focus.

Targeting VS Code developers and AI tool users, the extension's key innovation is an MCP server that uses workspace path detection to route popups accurately across multiple VS Code instances, supporting both HTTP and stdio protocols with zero configuration. This transforms AIs into interactive pair programmers, enabling use cases like quick architecture choices ("Which pattern?"), deployment confirmations ("Deploy now?"), or learning quizzes. With features like single-server coordination, status bar feedback, and graceful degradation, it enhances coding efficiency through immediate, button-based interactions.

## Problem Statement

In the current landscape of AI-assisted coding, assistants like GitHub Copilot, Claude, Cursor, and Cline are limited to chat-based interactions, where they can generate suggestions or explanations but cannot present structured choices or receive immediate, low-friction responses. This creates pain points such as interrupted workflows—developers must switch contexts to type responses in chat windows, often during critical moments like code reviews or debugging, leading to reduced productivity and cognitive overload.

The impact is significant: studies on developer tools show that context switching can reduce efficiency by up to 40% (e.g., as per productivity research from Microsoft and others), with AI interactions potentially exacerbating this in fast-paced coding sessions. Existing solutions fall short because they lack native integration with VS Code's UI; chat interfaces don't support button-based decisions, forcing verbose back-and-forth that breaks immersion and slows decision-making.

Solving this now is urgent as AI coding tools are rapidly evolving—with over 10 million VS Code users relying on extensions—the opportunity exists to enhance AI as true "pair programmers," preventing fragmented experiences that could hinder adoption of advanced AI features in development workflows.

## Proposed Solution

The core concept of Popup MCP is an VS Code extension that implements a Model Context Protocol (MCP) server to enable AI coding assistants to trigger interactive popup dialogs directly in the editor, capturing user decisions via button clicks and routing responses back seamlessly. The approach involves workspace path detection for accurate popup routing across multiple VS Code instances, support for both HTTP and stdio transports, and features like single-server coordination with client instances, status bar indicators, and graceful degradation for ambiguous scenarios.

Key differentiators include its zero-configuration setup, protocol-agnostic design, and native integration with VS Code's UI—unlike chat-only interfaces that require manual typing, this provides low-friction, context-preserving interactions that feel like natural extensions of the editor. It will succeed where others haven't by solving the multi-instance routing challenge through workspace awareness, which no current AI extension addresses, enabling reliable popups even in complex setups with multiple projects open.

The high-level vision is to evolve AI assistants from passive suggestors into active pair programmers that can engage in real-time, structured dialogues—ultimately creating a more immersive, efficient coding experience where decisions happen inline without breaking flow.

## Target Users

### Primary User Segment: VS Code Developers

- **Demographic/Firmographic Profile**: Software developers and engineers using VS Code as their primary IDE, with experience in AI-assisted coding tools like GitHub Copilot or Cursor.

- **Current Behaviors and Workflows**: Integrate AI for suggestions via chat but face context switches for decisions, often in multi-project setups with multiple VS Code windows.

- **Specific Needs and Pain Points**: Require quick, structured input to maintain flow; pains include cognitive load from typing responses and misrouted interactions in multi-instance environments.

- **Goals They're Trying to Achieve**: Boost productivity with seamless AI interactions, enable faster decisions, and treat AI as an interactive collaborator.

## Goals & Success Metrics

### Business Objectives
- Achieve 1,000 active users within 6 months of launch by targeting VS Code extension marketplace, measured via download/install metrics and user retention data.
- Generate positive community feedback with an average rating of 4.5/5 on the VS Code Marketplace within the first 3 months, through reviews and usage surveys.
- Establish partnerships with at least 2 major AI coding tools (e.g., integrations with Cursor or Copilot) within 12 months to expand reach.

### User Success Metrics
- Reduce context-switching time in AI interactions by 30% for users, measured through optional in-extension analytics or user-reported surveys.
- Increase user satisfaction with AI decision-making flows to 85% positive responses in post-interaction feedback.
- Enable at least 50% of popup interactions to resolve in under 10 seconds, tracked via anonymized usage data.

### Key Performance Indicators (KPIs)
- **Active Users**: Number of unique weekly users engaging with popups; target: 500 by month 3.
- **Popup Success Rate**: Percentage of popups that receive a response without errors; target: 95%.
- **Retention Rate**: Percentage of users still active after 30 days; target: 40%.
- **Error Rate**: Frequency of routing or protocol issues; target: <1% of interactions.

## MVP Scope

### Core Features (Must Have)
- **Popup Dialog Display**: Enable AI to trigger dialogs with custom titles, messages, and buttons in VS Code; rationale: Core to providing structured interactions without chat.
- **User Response Routing**: Capture button clicks and send responses back to AI via MCP; rationale: Ensures seamless, low-friction feedback loop.
- **Workspace-Aware Routing**: Use path detection to direct popups to the correct VS Code instance; rationale: Solves multi-window issues for reliable delivery. This has two parts: (1) Extension side - uses VS Code API to identify its workspace; (2) AI assistant side - includes workspace metadata (from chat context) with popup details for accurate targeting.
- **Protocol Support**: Handle both HTTP and stdio transports with zero configuration; rationale: Broad compatibility with AI tools like Cursor or Copilot.
- **Status Bar Indicator**: Show connection state and role (host/client); rationale: Provides user visibility and debugging aid.

### Out of Scope for MVP
- Advanced popup customization (e.g., themes, images)
- Multi-language support beyond English
- Analytics dashboard for usage tracking
- Integration with non-VS Code IDEs
- Automated error reporting

### MVP Success Criteria
The MVP will be considered successful if it achieves 80% popup success rate in multi-instance setups, garners at least 100 active users with positive feedback (4+ rating) in the first month, and demonstrates measurable reduction in context-switching via user surveys.

## Post-MVP Vision

### Phase 2 Features
Building on the core popup and routing functionality, introduce enhancements like basic popup customization (e.g., themes and icons), integration with additional protocols, and simple analytics for usage patterns to inform further improvements.

### Long-term Vision
In 1-2 years, evolve Popup MCP into a comprehensive AI-UI bridge for VS Code, enabling more advanced interactions like multi-step dialogs or embedded forms, positioning it as the standard for interactive AI in development environments.

### Expansion Opportunities
Potential expansions include support for other IDEs (e.g., JetBrains), partnerships with AI providers for native integration, and open-source contributions to extend protocol standards for broader ecosystem adoption.

## Technical Considerations

### Platform Requirements
- **Target Platforms**: VS Code on Windows, macOS, and Linux.
- **Browser/OS Support**: Compatible with VS Code versions 1.70+; no specific browser requirements as it's an extension.
- **Performance Requirements**: Low overhead (under 50ms latency for popup display); minimal memory usage for multi-instance support.

### Technology Preferences
- **Frontend**: TypeScript with VS Code Extension API for UI elements.
- **Backend**: Node.js for MCP server implementation.
- **Database**: None required for MVP; local storage if needed for configs.
- **Hosting/Infrastructure**: Self-hosted within VS Code; no external servers.

### Architecture Considerations
- **Repository Structure**: Monorepo with src/ for core logic, tests/, and package.json for extension packaging.
- **Service Architecture**: Single MCP server with client extensions for multi-instance coordination.
- **Integration Requirements**: API hooks for AI tools via HTTP/stdio; VS Code API for workspace detection.
- **Security/Compliance**: Ensure no data collection without consent; follow VS Code extension security guidelines.

## Constraints & Assumptions

### Constraints
- **Budget**: Open-source project with no dedicated funding; reliant on volunteer contributions.
- **Timeline**: Target MVP release within 3 months, subject to developer availability.
- **Resources**: Solo or small team development; limited to part-time effort.
- **Technical**: Dependent on VS Code API stability; potential limitations in multi-instance communication.

### Key Assumptions
- AI assistants will include workspace metadata in requests as needed for routing.
- Users have basic familiarity with VS Code extensions and AI tools.
- No major changes to VS Code's extension model in the near term.
- Community interest in interactive AI features will drive adoption.

## Risks & Open Questions

### Key Risks
- **Adoption Risk**: Low uptake if AI tools don't integrate easily; impact: Limited user base and feedback.
- **Technical Risk**: Issues with multi-instance routing in edge cases (e.g., remote workspaces); impact: Unreliable popups leading to poor user experience.
- **Dependency Risk**: Changes in VS Code API or AI protocols; impact: Breaking functionality requiring updates.
- **Security Risk**: Potential misuse of popups for phishing; impact: Trust erosion and marketplace removal.

### Open Questions
- How will AI assistants handle popup responses in their workflows?
- What fallback mechanisms are needed for unsupported environments?
- How to measure real-world productivity gains accurately?

### Areas Needing Further Research
- Compatibility testing with popular AI tools (e.g., Copilot, Cursor) - initial tests confirm functionality in VS Code (with GitHub Copilot and Augment Code), Windsurf (HTTP transport), and Cursor (stdio transport).
- User studies on popup UX preferences.
- Legal aspects of extension data handling.

## Next Steps

### Immediate Actions
1. Set up project repository and initial extension skeleton.
2. Prototype core popup and routing features.
3. Test multi-instance scenarios with sample AI integrations.
4. Publish alpha version to VS Code Marketplace for early feedback.

### PM Handoff
This Project Brief provides the full context for Popup MCP. Please start in 'PRD Generation Mode', review the brief thoroughly to work with the user to create the PRD section by section as the template indicates, asking for any necessary clarification or suggesting improvements.
