# External Links System Design

## 📋 Overview
A flexible external links system for Kaneo tasks that supports both automatic integration links (Gitea/GitHub) and manual user links (documentation, references, etc.).

---

## 🗄️ Database Schema

```sql
CREATE TABLE "external_links" (
  "id" text PRIMARY KEY NOT NULL,
  "task_id" text NOT NULL REFERENCES "task"("id") ON DELETE cascade,
  "type" text NOT NULL,              -- Link type/category
  "title" text NOT NULL,             -- User-friendly display name
  "url" text NOT NULL,               -- Full URL to external resource
  "external_id" text,                -- Issue number/ID (only for integrations)
  "created_at" timestamp DEFAULT now() NOT NULL,
  "created_by" text REFERENCES "user"("email") ON DELETE SET NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Index for performance
CREATE INDEX "external_links_task_id_idx" ON "external_links"("task_id");
CREATE INDEX "external_links_type_idx" ON "external_links"("type");
```

## 📝 Link Types

### Integration Links (Automatic)
- **`gitea_integration`** - Gitea issues with bidirectional sync
- **`github_integration`** - GitHub issues with bidirectional sync

### User Links (Manual)
- **`documentation`** - API docs, specifications, requirements
- **`reference`** - Wikipedia, Stack Overflow, tutorials
- **`design`** - Figma, mockups, wireframes
- **`ticket`** - External ticketing systems (Jira, etc.)
- **`custom`** - Any other external resource

---

## 🎨 UI Components

### Link List Component
```tsx
interface ExternalLink {
  id: string;
  taskId: string;
  type: 'gitea_integration' | 'github_integration' | 'documentation' | 'reference' | 'design' | 'ticket' | 'custom';
  title: string;
  url: string;
  externalId?: string;
  createdAt: Date;
  createdBy?: string;
}

interface LinkListProps {
  taskId: string;
  links: ExternalLink[];
  onAddLink: () => void;
  onEditLink: (link: ExternalLink) => void;
  onDeleteLink: (linkId: string) => void;
  onUnlinkIntegration: (linkId: string) => void;
}
```

### Link Type Icons
- **Gitea Integration**: `<GitBranch />` with Gitea colors
- **GitHub Integration**: `<Github />` with GitHub colors
- **Documentation**: `<BookOpen />`
- **Reference**: `<ExternalLink />`
- **Design**: `<Palette />`
- **Ticket**: `<Ticket />`
- **Custom**: `<Link />`

### Add Link Modal
```tsx
interface AddLinkModalProps {
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (link: Omit<ExternalLink, 'id' | 'createdAt'>) => void;
}

// Form fields:
// - Type (dropdown with icons)
// - Title (text input)
// - URL (URL input with validation)
// - Auto-populate title from URL when possible
```

---

## 🔧 API Endpoints

### Link Management
```typescript
// GET /api/tasks/:taskId/links
interface GetLinksResponse {
  links: ExternalLink[];
}

// POST /api/tasks/:taskId/links
interface CreateLinkRequest {
  type: string;
  title: string;
  url: string;
  externalId?: string;
}

// PUT /api/tasks/:taskId/links/:linkId
interface UpdateLinkRequest {
  title?: string;
  url?: string;
}

// DELETE /api/tasks/:taskId/links/:linkId
interface DeleteLinkResponse {
  success: boolean;
}

// POST /api/tasks/:taskId/links/:linkId/unlink
// Special endpoint for unlinking integrations while preserving the link as reference
```

---

## 🔄 Integration Migration

### Current State (Description-based)
```markdown
Task Description:
"Fix the login bug

Some detailed description...

---
*Linked to Gitea issue: http://localhost:3001/user/repo/issues/42*"
```

### New State (External Links)
```typescript
// Task description (clean):
"Fix the login bug

Some detailed description..."

// External links (separate):
[
  {
    id: "link_123",
    taskId: "task_456",
    type: "gitea_integration",
    title: "Gitea Issue #42",
    url: "http://localhost:3001/user/repo/issues/42",
    externalId: "42",
    createdAt: "2025-08-07T10:00:00Z",
    createdBy: "user@example.com"
  }
]
```

### Migration Script
```typescript
async function migrateExistingLinks() {
  // 1. Find all tasks with GitHub/Gitea links in descriptions
  // 2. Extract link information using regex patterns
  // 3. Create external_links records
  // 4. Clean descriptions (remove link footers)
  // 5. Update integration handlers to use external_links
}
```

---

## 🔗 Integration Handler Updates

### Before (Description Parsing)
```typescript
const giteaIssueUrlMatch = task.description?.match(
  new RegExp(`Linked to Gitea issue: (${giteaClient.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/[^/]+/[^/]+/issues/\\d+)`)
);

if (!giteaIssueUrlMatch) {
  return; // Cannot sync
}
```

### After (External Links)
```typescript
const giteaLink = await db.query.externalLinksTable.findFirst({
  where: and(
    eq(externalLinksTable.taskId, taskId),
    eq(externalLinksTable.type, 'gitea_integration')
  )
});

if (!giteaLink) {
  return; // Task not linked to Gitea
}

const issueNumber = giteaLink.externalId;
const issueUrl = giteaLink.url;
```

---

## 🎯 User Experience Flow

### Adding Links
1. **Manual Links**: User clicks "Add Link" → Select type → Enter title & URL
2. **Integration Links**: Automatic when connecting Gitea/GitHub issues
3. **Quick Add**: Right-click on URL in description → "Add as External Link"

### Managing Links
1. **View**: Links displayed in sidebar or dedicated tab
2. **Edit**: Click link → Edit title/URL in modal
3. **Delete**: Hover link → Delete button with confirmation
4. **Unlink Integration**: Special "Unlink" action converts integration link to reference link

### Link Actions
- **Open**: Click link → Opens in new tab
- **Copy**: Right-click → Copy URL
- **Edit**: Click edit icon → Edit modal
- **Delete**: Click delete icon → Confirmation dialog

---

## ⚡ Implementation Benefits

### For Users
- ✅ **Rich Context**: Add unlimited relevant links to tasks
- ✅ **Reliable Sync**: Integration links never break from description edits
- ✅ **Easy Management**: Full CRUD operations on links
- ✅ **Visual Clarity**: Clear distinction between link types
- ✅ **Bulk Operations**: Manage multiple links efficiently

### For Developers
- ✅ **Robust Sync**: Reliable external issue tracking
- ✅ **Extensible**: Easy to add new link types
- ✅ **Clean Separation**: Links separate from content
- ✅ **Better Performance**: Indexed queries instead of regex parsing
- ✅ **Audit Trail**: Track who added what links when

### For Integrations
- ✅ **Reliable Identification**: Never lose track of linked issues
- ✅ **Multiple Links**: Support multiple external issues per task
- ✅ **Graceful Unlinking**: Convert integration links to references
- ✅ **Consistent API**: Same pattern for all external integrations

---

## 🚀 Implementation Phases

### Phase 1: Foundation ✅
- [x] Create database migration
- [x] Create basic CRUD API endpoints
- [x] Build core UI components
- [x] Add link management to task detail view

### Phase 2: Integration Migration ✅
- [x] Update Gitea integration to use external links
- [x] Update GitHub integration to use external links
- [x] Create hybrid compatibility system for backward compatibility
- [x] Enable automatic migration from description to external_links

### Phase 3: Enhanced Features (In Progress)
- [ ] Link previews and favicons
- [ ] Bulk link operations
- [ ] Link validation and URL verification
- [ ] Quick add from task descriptions
- [ ] Link analytics and usage tracking

### Phase 4: Advanced Features
- [ ] Link templates for common resources
- [ ] Auto-link detection in descriptions
- [ ] Link synchronization across related tasks
- [ ] Integration with other external tools

---

## 🔄 Hybrid Compatibility System

### Implementation Overview
The system now implements a **hybrid approach** that maintains backward compatibility with the existing GitHub integration while providing a clean migration path:

### Hybrid Functions
```typescript
// hybrid-integration-utils.ts
export async function getIntegrationLinkHybrid({
  taskId,
  type,
}: {
  taskId: string;
  type: "gitea_integration" | "github_integration";
}) {
  // 1. Try to get from external_links table (new approach)
  const externalLink = await getIntegrationLink({ taskId, type });
  if (externalLink) {
    return {
      id: externalLink.id,
      issueNumber: externalLink.externalId,
      issueUrl: externalLink.url,
      source: "external_links" as const,
    };
  }

  // 2. Fall back to description parsing (legacy approach)
  return parseDescriptionForLink(taskId, type);
}
```

### Migration Strategy
- **New Tasks**: Use external_links table from the start
- **Legacy Tasks**: Automatically migrate when hybrid functions detect description-based links
- **Dual Support**: Both systems work simultaneously during transition period

### Benefits
- ✅ **Zero Breaking Changes**: Existing GitHub integration continues working
- ✅ **Automatic Migration**: Legacy links converted seamlessly when accessed
- ✅ **Future-Ready**: New approach provides better reliability and features
- ✅ **Gradual Transition**: No forced migration required

---

**This system transforms task external references from fragile description-based links to a robust, user-friendly link management system! 🔗✨**
