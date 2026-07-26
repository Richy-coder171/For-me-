```markdown
# For-me- Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns and conventions used in the **For-me-** TypeScript codebase. You'll learn how to structure files, write imports/exports, follow commit message conventions, and organize tests. These guidelines help maintain code consistency and readability across the project.

## Coding Conventions

### File Naming
- **Style:** kebab-case
- **Example:**  
  ```
  user-profile.ts
  data-fetcher.test.ts
  ```

### Import Style
- **Style:** Relative imports
- **Example:**  
  ```typescript
  import { fetchData } from './data-fetcher';
  ```

### Export Style
- **Style:** Named exports
- **Example:**  
  ```typescript
  // In data-fetcher.ts
  export function fetchData() { ... }
  ```

### Commit Messages
- **Style:** Conventional commits
- **Prefix:** `docs`
- **Example:**  
  ```
  docs: update README with usage instructions
  ```

## Workflows

### Writing Documentation Commits
**Trigger:** When updating or adding documentation  
**Command:** `/docs-commit`

1. Make your documentation changes.
2. Stage the changes:  
   ```
   git add .
   ```
3. Commit using the conventional commit style with the `docs` prefix:  
   ```
   git commit -m "docs: describe new API endpoint"
   ```
4. Push your changes:  
   ```
   git push
   ```

## Testing Patterns

- **Test File Naming:**  
  Test files use the pattern `*.test.*` (e.g., `user-profile.test.ts`).
- **Testing Framework:**  
  Not explicitly detected; follow the file naming convention for test discovery.
- **Example:**  
  ```typescript
  // user-profile.test.ts
  import { getUserProfile } from './user-profile';

  describe('getUserProfile', () => {
    it('returns user data', () => {
      // test implementation
    });
  });
  ```

## Commands
| Command        | Purpose                                      |
|----------------|----------------------------------------------|
| /docs-commit   | Commit documentation changes using conventions|
```
