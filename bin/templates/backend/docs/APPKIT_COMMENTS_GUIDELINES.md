# AppKit Comment Standards

Documentation guidelines for AppKit backend applications optimized for developers and AI systems.

## Template

**File Header:**
```typescript
/**
 * Brief description
 * @module @bloomneo/package/module
 * @file src/path/file.ts
 *
 * @llm-rule WHEN: Use case trigger
 * @llm-rule AVOID: Major pitfalls
 * @llm-rule NOTE: Critical context (optional)
 */
```

**Function:**
```typescript
/**
 * Function description
 * @llm-rule WHEN: Specific use case
 * @llm-rule AVOID: Common mistakes
 * @llm-rule NOTE: Non-obvious behavior (optional)
 */
```

## Rules

**Categories:**
- **WHEN** - Trigger conditions
- **AVOID** - Breaking mistakes
- **NOTE** - Critical context (optional)

**Guidelines:**
- Maximum 3 rules per item
- One line per rule
- Action-oriented language
- Specific use cases vs common pitfalls

## Examples

**Good:**
```typescript
@llm-rule WHEN: Building apps with user roles and permissions
@llm-rule AVOID: Simple login apps - adds unnecessary complexity

@llm-rule WHEN: Storing user passwords
@llm-rule AVOID: Plain text passwords - security vulnerability
```

**Avoid:**
```typescript
@llm-rule WHEN: Need to call this function
@llm-rule PURPOSE: Returns user data
@llm-rule USAGE: This function should be used when...
```

**Standard for all AppKit backend applications - ensures developer-friendly and AI-ready code.**
