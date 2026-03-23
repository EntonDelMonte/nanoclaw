---
name: unit-testing
description: Write and run component unit tests with Vitest and React Testing Library — props, rendering, user events, state changes, mocking, and coverage reports.
allowed-tools: Bash(unit-testing:*), Read, Write
---

# Unit Testing — Vitest + React Testing Library

## Overview

Component unit testing for React/Vite projects using Vitest as the test runner and React Testing Library (RTL) for DOM interaction. This skill covers the full workflow: scaffolding test files, writing assertions, mocking dependencies, and generating coverage reports. Each test file targets one component and is scoped to ~8k tokens so it fits cleanly in a single agent pass.

## Prerequisites

Node.js project with a `package.json`. For React/Vite projects these packages are recommended:

```bash
npm install --save-dev vitest @vitest/coverage-v8 @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

Add to `vite.config.ts` (or create `vitest.config.ts`):

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'src/test/'],
    },
  },
});
```

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom';
```

Add to `package.json` scripts:

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

## Usage

### Run tests

```bash
# Watch mode (development)
npm test

# Single run (CI)
npm run test:run

# With coverage report
npm run test:coverage

# Run a specific file
npx vitest run src/components/Button.test.tsx
```

### Test file structure

Place test files adjacent to the component or in a `__tests__` folder:

```
src/
  components/
    Button.tsx
    Button.test.tsx        ← preferred: co-located
  __tests__/
    Button.test.tsx        ← alternative: centralised
```

### Basic component test

```tsx
// src/components/Button.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders with label', () => {
    render(<Button label="Click me" />);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button label="Go" onClick={onClick} />);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled when prop is set', () => {
    render(<Button label="Go" disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

### Testing props and conditional rendering

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('applies variant class', () => {
    render(<Badge variant="success">OK</Badge>);
    expect(screen.getByText('OK')).toHaveClass('badge--success');
  });

  it('renders nothing when hidden prop is set', () => {
    const { container } = render(<Badge hidden>Hidden</Badge>);
    expect(container).toBeEmptyDOMElement();
  });
});
```

### Testing state changes

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { Counter } from './Counter';

describe('Counter', () => {
  it('starts at zero', () => {
    render(<Counter />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('increments on button click', async () => {
    const user = userEvent.setup();
    render(<Counter />);
    await user.click(screen.getByRole('button', { name: /increment/i }));
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('resets to zero', async () => {
    const user = userEvent.setup();
    render(<Counter initialValue={5} />);
    await user.click(screen.getByRole('button', { name: /reset/i }));
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
```

### Mocking modules and dependencies

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserCard } from './UserCard';

// Mock an entire module
vi.mock('../api/users', () => ({
  fetchUser: vi.fn(),
}));

import { fetchUser } from '../api/users';

describe('UserCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    vi.mocked(fetchUser).mockReturnValue(new Promise(() => {})); // never resolves
    render(<UserCard userId="1" />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders user data after fetch', async () => {
    vi.mocked(fetchUser).mockResolvedValue({ name: 'Alice', email: 'alice@example.com' });
    render(<UserCard userId="1" />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });

  it('shows error on fetch failure', async () => {
    vi.mocked(fetchUser).mockRejectedValue(new Error('Network error'));
    render(<UserCard userId="1" />);
    await waitFor(() => expect(screen.getByText(/error/i)).toBeInTheDocument());
  });
});
```

### Mocking child components

```tsx
// Isolate the component under test from its children
vi.mock('./Chart', () => ({
  Chart: ({ title }: { title: string }) => <div data-testid="mock-chart">{title}</div>,
}));
```

### Testing forms

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  it('submits with email and password', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/password/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      email: 'alice@example.com',
      password: 'secret123',
    });
  });

  it('shows validation error for empty email', async () => {
    const user = userEvent.setup();
    render(<LoginForm onSubmit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.getByText(/email is required/i)).toBeInTheDocument();
  });
});
```

### Testing hooks

```tsx
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useCounter } from './useCounter';

describe('useCounter', () => {
  it('returns initial count', () => {
    const { result } = renderHook(() => useCounter(0));
    expect(result.current.count).toBe(0);
  });

  it('increments count', () => {
    const { result } = renderHook(() => useCounter(0));
    act(() => result.current.increment());
    expect(result.current.count).toBe(1);
  });
});
```

## Examples

### Full test file checklist

A well-scoped test file for one component should cover:

- [ ] Default render (snapshot or text assertion)
- [ ] Required props variants
- [ ] Optional props / conditional branches
- [ ] User interactions (click, type, focus)
- [ ] State transitions
- [ ] Async behaviour (loading, success, error)
- [ ] Accessibility roles and labels (`getByRole`, `getByLabelText`)

### Coverage report

After running `npm run test:coverage`, open `coverage/index.html` in a browser for a line-by-line breakdown. Target thresholds for production code:

```ts
// vitest.config.ts
coverage: {
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 70,
    statements: 80,
  },
},
```

## Notes

- Prefer `getByRole` and `getByLabelText` over `getByTestId` — they test accessible behaviour, not implementation details.
- `userEvent.setup()` must be called inside the test or `beforeEach`, not at module level, to get a fresh instance per test.
- `vi.clearAllMocks()` in `beforeEach` prevents mock state leaking between tests.
- Avoid testing internal state directly; test what the user sees and can interact with.
- For components that use React context, wrap in the provider inside the test or create a custom `render` helper in `src/test/utils.tsx`.
- Keep test files under ~300 lines (~8k tokens). If a file grows larger, split by feature area.
