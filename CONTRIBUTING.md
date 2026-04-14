# Contributing to @bloomneo/appkit

Thank you for your interest in contributing to @bloomneo/appkit! We welcome
contributions from the community and are excited to have you on board.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Reporting Issues](#reporting-issues)
- [Security Vulnerabilities](#security-vulnerabilities)
- [License](#license)

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/appkit.git
   cd appkit
   ```
3. Add the upstream repository:
   ```bash
   git remote add upstream https://github.com/bloomneo/appkit.git
   ```
4. Create a new branch for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0

### Installation

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run tests to ensure everything is working:

   ```bash
   npm test
   ```

3. Start development:
   ```bash
   npm run test:watch
   ```

## Project Structure

```
appkit/
├── src/
│   ├── auth/                    # Authentication module
│   │   ├── auth.ts             # Core authentication class
│   │   ├── defaults.ts         # Smart defaults and validation
│   │   ├── index.ts            # Module exports
│   │   └── README.md           # Module documentation
│   ├── cache/                   # Cache module with Redis/Memory strategies
│   │   └── strategies/         # Cache implementation strategies
│   ├── config/                  # Configuration module
│   │   ├── config.ts           # Core configuration class
│   │   ├── defaults.ts         # Environment parsing and defaults
│   │   ├── index.ts            # Module exports
│   │   └── README.md           # Module documentation
│   ├── database/                # Database module with adapters
│   │   └── adapters/           # Database adapters (Prisma, Mongoose)
│   ├── email/                   # Email module
│   │   └── strategies/         # Email strategies
│   ├── error/                   # Error handling module
│   ├── event/                   # Event handling module
│   │   └── strategies/         # Event strategies
│   ├── logger/                  # Logger module
│   │   └── transports/         # Logger transports (Console, File, etc.)
│   ├── queue/                   # Queue module
│   │   └── transports/         # Queue transports
│   ├── security/                # Security utilities
│   ├── storage/                 # Storage module
│   │   └── strategies/         # Storage strategies
│   ├── util/                    # Utility functions
│   └── index.ts                # Main AppKit exports
├── bin/                         # CLI tools
│   ├── commands/               # CLI command implementations
│   ├── templates/              # Project templates
│   └── appkit.js              # Main CLI entry point
├── docs/                        # Project documentation
├── CONTRIBUTING.md             # This file
├── README.md                   # Project overview
├── package.json               # Project metadata
└── vitest.config.js           # Test configuration
```

## How to Contribute

### Types of Contributions

1. **Bug Fixes**: Fix issues reported in GitHub Issues
2. **New Features**: Add new functionality to existing modules
3. **New Modules**: Create entirely new modules for the toolkit
4. **Documentation**: Improve or add documentation
5. **CLI Templates**: Add or improve project templates
6. **Tests**: Add test coverage (testing infrastructure is being developed)

### Development Workflow

1. **Pick an Issue**: Look for issues labeled `good first issue` or
   `help wanted`
2. **Discuss**: Comment on the issue to let others know you're working on it
3. **Code**: Make your changes following our coding standards
4. **Test**: Write tests for your changes
5. **Document**: Update documentation if needed
6. **Submit**: Create a pull request

## Pull Request Process

1. **Update your branch**:

   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Test your changes**:

   ```bash
   npm test                    # Run tests (when available)
   npm run build              # Build TypeScript
   npm run lint               # Run linting
   ```

3. **Update documentation**:

   - Update relevant README.md files in module directories
   - Update CLI templates if needed
   - Update main README.md if needed

4. **Create Pull Request**:

   - Use a clear, descriptive title
   - Reference any related issues
   - Describe what changes you made and why
   - Include screenshots for UI changes

5. **Code Review**:
   - Address review feedback
   - Keep your PR up to date with main branch
   - Be patient and respectful

### PR Title Format

```
type(module): description

Examples:
feat(auth): add OAuth support
fix(auth): handle expired tokens correctly
docs(auth): update JWT examples
test(auth): add middleware integration tests
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `style`, `chore`

## Coding Standards

### API Naming

Public API names follow [`NAMING.md`](./NAMING.md). Any new public method,
class, env var, or error type must comply with the patterns in that doc
(`get<Thing>` for nullable extractors, `has` / `is` / `can` for booleans,
`require<Thing>` for middleware factories, etc.). PRs that add or rename
public API without following the policy will be asked to update.

### JavaScript Style

- ES modules (ESM)
- Use single quotes for strings
- 2-space indentation
- Use semicolons
- Use `async/await` over promises
- Avoid `var`, use `const` and `let`

### File Naming

- Use lowercase with hyphens for file names
- Test files: `*.test.ts`
- Example files: descriptive names like `user-authentication.ts`

### Code Structure

```javascript
/**
 * Function description
 * @param {Type} paramName - Parameter description
 * @returns {ReturnType} Return description
 * @throws {Error} Error conditions
 */
export function functionName(paramName) {
  // Implementation
}
```

### LLM-friendly comment annotations

AppKit source uses a structured `@llm-rule` annotation in JSDoc to give AI
coding agents prescriptive guidance directly inside the source files. When
adding or modifying public APIs, add these to the function or file header:

```typescript
/**
 * Brief description
 * @module @bloomneo/appkit/auth
 * @file src/auth/auth.ts
 *
 * @llm-rule WHEN: Building apps with user roles and permissions
 * @llm-rule AVOID: Simple login apps — adds unnecessary complexity
 * @llm-rule NOTE: Token expiry is configurable via BLOOM_AUTH_EXPIRY (optional)
 */
```

**Three categories:**
- `@llm-rule WHEN:` — concrete trigger conditions for using this API
- `@llm-rule AVOID:` — common mistakes or anti-patterns this API shouldn't be used for
- `@llm-rule NOTE:` — non-obvious behavior or critical context (optional)

**Guidelines:**
- Maximum 3 rules per item
- One line per rule, action-oriented
- Be specific (not "Need to call this function" — that's useless)
- Cover both the happy path (`WHEN`) and the failure mode (`AVOID`)

**Bad example (don't do this):**
```typescript
@llm-rule WHEN: Need to call this function
@llm-rule PURPOSE: Returns user data
@llm-rule USAGE: This function should be used when...
```

**Good example:**
```typescript
@llm-rule WHEN: Building apps with user roles and permissions
@llm-rule AVOID: Simple login apps — adds unnecessary complexity
```

These annotations are read by `@bloomneo/appkit`'s `llms.txt` generator and
surfaced to AI coding agents as canonical guidance. Inconsistent or vague
annotations make the agent-facing docs worse.

### Error Handling

- Use descriptive error messages
- Throw errors for exceptional cases
- Handle errors gracefully in middleware

## Testing Guidelines

### Current State

Testing infrastructure is currently being developed. For now, focus on:

- **Manual Testing**: Test your changes manually with example implementations
- **TypeScript Compilation**: Ensure code compiles without errors
- **Linting**: Follow code style guidelines
- **CLI Testing**: Test CLI commands manually

### Future Test Structure (When Available)

```typescript
import { describe, it, expect } from 'vitest';

describe('Module/Function Name', () => {
  describe('functionName', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = functionName(input);

      // Assert
      expect(result).toBe('expected');
    });

    it('should handle error case', () => {
      expect(() => functionName(null)).toThrow('Expected error');
    });
  });
});
```

### Running Tests

```bash
# Build and check TypeScript
npm run build

# Run linting
npm run lint

# Test CLI commands manually
node bin/appkit.js --help
```

## Documentation

### Documentation Structure

Each module currently has:

1. **README.md**: Comprehensive module documentation with examples
2. **TypeScript types**: Full type definitions for all exports
3. **JSDoc comments**: Inline documentation in source code
4. **LLM rules**: Special @llm-rule comments for AI code generation guidance

### Documentation Standards

- Use clear, concise language
- Include code examples
- Explain the "why" not just the "what"
- Keep documentation up to date with code changes

### Example Documentation

````markdown
## functionName(param1, param2)

Description of what the function does.

### Parameters

| Name   | Type   | Required | Default | Description           |
| ------ | ------ | -------- | ------- | --------------------- |
| param1 | string | Yes      | -       | Description of param1 |
| param2 | number | No       | 10      | Description of param2 |

### Returns

- `ReturnType` - Description of return value

### Example

\```typescript
const result = functionName('test', 5);
console.log(result); // Expected output
\```

### LLM Rules

```typescript
/**
 * @llm-rule WHEN: Building apps that need this functionality
 * @llm-rule AVOID: Common mistakes developers make
 * @llm-rule NOTE: Important implementation details
 */
```
````

## Reporting Issues

### Before Creating an Issue

1. Search existing issues to avoid duplicates
2. Check if the issue is already fixed in the main branch
3. Verify the issue is reproducible

### Creating an Issue

Use our issue templates and include:

- Clear, descriptive title
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (OS, Node.js version)
- Code samples or error messages

### Issue Labels

- `bug`: Something isn't working
- `enhancement`: New feature request
- `documentation`: Documentation improvements
- `good first issue`: Good for newcomers
- `help wanted`: Extra attention needed

## Security Vulnerabilities

If you discover a security vulnerability:

1. **DO NOT** create a public GitHub issue
2. Email security@bloomneo.com with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and work with you to resolve the issue.

## Code of Conduct

### Our Standards

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Accept constructive criticism gracefully
- Focus on what's best for the community

### Enforcement

Unacceptable behavior should be reported to conduct@bloomneo.com. All complaints
will be reviewed and investigated promptly and fairly.

## License

By contributing, you agree that your contributions will be licensed under the
MIT License.

## Recognition

Contributors will be recognized in:

- The project's CONTRIBUTORS.md file
- Release notes for significant contributions
- Our website's contributors page

## Questions?

- Email us at support@bloomneo.com
- Create a discussion in GitHub Discussions

---

Thank you for contributing to @bloomneo/appkit! 🚀
