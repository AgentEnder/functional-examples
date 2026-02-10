# Eta Template Engine Guide

Eta is a lightweight, fast, pluggable embedded JS template engine written in TypeScript for Node, Deno, and browsers.

## Installation & Import

```bash
npm install eta
```

```typescript
import { Eta } from 'eta';
```

## Basic Programmatic API

### Creating an Eta Instance

```typescript
const eta = new Eta({
  views: path.join(__dirname, 'templates'),
  // Optional configuration
  cache: true,
  autoEscape: true
});
```

### Rendering Methods

#### 1. `render()` - Sync rendering of named templates

```typescript
const result = eta.render('./template-name', {
  name: 'Ben',
  items: [1, 2, 3]
});
```

#### 2. `renderAsync()` - Async rendering

```typescript
const result = await eta.renderAsync('./template-name', {
  name: 'Ada Lovelace',
  asyncFunc: async () => 'async result'
});
```

#### 3. `renderString()` - Render template strings directly (v3+)

```typescript
const result = eta.renderString('<%= it.name %>', { name: 'Ben' });
```

#### 4. `renderStringAsync()` - Async template string rendering (v3+)

```typescript
const result = await eta.renderStringAsync(
  '<%= it.name %>: <%= await it.asyncFunc() %>',
  {
    name: 'Ada Lovelace',
    asyncFunc: async () => 'result'
  }
);
```

#### 5. `renderFile()` / `renderFileAsync()` - Render from file path

```typescript
const result = await eta.renderFileAsync('./path/to/template', { data });
```

## Template Syntax & Delimiters

### Default Delimiters

- `<%= ... %>` - Output escaped value
- `<%~ ... %>` - Output raw/unescaped value
- `<% ... %>` - JavaScript code execution (control flow, loops, etc.)
- `<%# ... %>` - Comments (not rendered)

### Custom Delimiters

Eta supports custom delimiters:

```typescript
const eta = new Eta({
  tags: ['{{', '}}']  // Use {{ }} instead of <% %>
});
```

### Template Syntax Examples

```ejs
<%# Comments %>

<% /* Evaluate JavaScript */ %>
<% if (it.user) { %>
  <p>Hello <%= it.user.name %></p>
<% } %>

<% /* Loops */ %>
<% it.items.forEach(item => { %>
  <li><%= item %></li>
<% }) %>

<% /* Async operations */ %>
<%= await getSomeValue() %>

<% /* Raw output (unescaped) */ %>
<%~ it.htmlContent %>
```

## Passing Custom Functions & Data

All data is passed as an object, accessible via `it` in templates:

```typescript
const result = eta.render('./template', {
  name: 'Ben',
  items: [1, 2, 3],
  // Custom helper functions
  formatDate: (date) => date.toISOString(),
  uppercase: (str) => str.toUpperCase(),
  // Async functions
  fetchData: async () => { /* ... */ }
});
```

In template:

```ejs
<%= it.uppercase(it.name) %>
<%= it.formatDate(new Date()) %>
<%= await it.fetchData() %>
```

### No Need for Helper Registration

Unlike some template engines, Eta doesn't require registering helpers separately. You can write JavaScript directly in templates and pass functions as data.

## Partials (Includes)

### Sync Partials

```ejs
<%~ include('./path-to-partial') %>

<%# Pass additional data to partial %>
<%~ include('./partial', { option: true, extra: 'data' }) %>
```

### Async Partials

```ejs
<%~ await includeAsync('./async-partial') %>
<%~ await includeAsync('./partial', { data }) %>
```

## Layouts

```ejs
<% layout('./layouts/base') %>

<h1>Page Content</h1>
<p>This content will be available as it.body in the layout</p>
```

Layout template (`layouts/base.eta`):

```ejs
<!DOCTYPE html>
<html>
<head><title>My Site</title></head>
<body>
  <%~ it.body %>
</body>
</html>
```

## Async Support

Eta supports async rendering in two ways:

1. **Use async render methods**: `renderAsync()`, `renderStringAsync()`, `renderFileAsync()`
2. **Configure async mode**: Set `async: true` in Eta configuration

```typescript
const eta = new Eta({ async: true });
```

Template with async:

```ejs
<%= await fetch('https://api.example.com/data').then(r => r.json()) %>
```

## Configuration Options

```typescript
const eta = new Eta({
  views: './templates',        // Template directory
  cache: true,                 // Cache compiled templates
  autoEscape: true,            // Auto-escape output by default
  async: false,                // Enable async mode
  tags: ['<%', '%>'],          // Custom delimiters
  varName: 'it',               // Default variable name
  autoTrim: [false, 'nl']      // Whitespace control
});
```

## Key Features

- **Written in TypeScript** with full type support
- **Tiny bundle size** - lightweight and fast
- **No helper registration needed** - use JavaScript directly
- **Async/await support** - first-class async operations
- **Partials & layouts** - template composition
- **Custom delimiters** - configure to your preference
- **Precompilation** - compile templates ahead of time
- **Works everywhere** - Node, Deno, browsers

## API Signature Summary

```typescript
// Sync rendering
eta.render(template: string, data: object): string

// Async rendering
eta.renderAsync(template: string, data: object): Promise<string>

// String rendering (v3+)
eta.renderString(templateString: string, data: object): string
eta.renderStringAsync(templateString: string, data: object): Promise<string>

// File rendering
eta.renderFile(filePath: string, data: object, callback?: Function): string | void
eta.renderFileAsync(filePath: string, data: object): Promise<string>
```

## Sources

- [Eta Official Documentation](https://eta.js.org/)
- [Eta on npm](https://www.npmjs.com/package/eta)
- [Eta GitHub Repository](https://github.com/bgub/eta)
- [Template Syntax Documentation](https://eta.js.org/docs/4.x.x/intro/template-syntax)
- [Async Support Documentation](https://eta.js.org/docs/2.x.x/learn/async)
- [Eta v3 Introduction](https://dev.to/bgub/introducing-eta-v3-8m9)
