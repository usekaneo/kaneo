# GitHub vs. Gitea Integration - Comparison Table

## Overview

This table compares the implementation and features of the GitHub and Gitea integrations in Kaneo.

## 🔐 Authentication & Setup

| Aspect | GitHub Integration | Gitea Integration |
|--------|-------------------|-------------------|
| **Authentication Model** | OAuth GitHub App with complex installation | Simple Access Token |
| **Setup Complexity** | High - requires GitHub App creation, webhook setup, installation | Low - just generate token |
| **Required Credentials** | 6 environment variables:<br/>• `GITHUB_APP_ID`<br/>• `GITHUB_CLIENT_ID`<br/>• `GITHUB_CLIENT_SECRET`<br/>• `GITHUB_PRIVATE_KEY`<br/>• `GITHUB_WEBHOOK_SECRET`<br/>• `GITHUB_APP_NAME` | None - configuration via UI |
| **Configuration** | Server-side environment variables required | Fully configurable in UI |
| **Permissions** | Granular app permissions with installation | Token-based, depends on user rights |

## 🎛️ Frontend Configuration

| Aspect | GitHub Integration | Gitea Integration |
|--------|-------------------|-------------------|
| **Configuration Fields** | 2 fields:<br/>• Repository Owner<br/>• Repository Name | 5 fields:<br/>• Gitea URL<br/>• Repository Owner<br/>• Repository Name<br/>• Access Token<br/>• Webhook Secret (32+ characters) |
| **Icon** | GitHub Icon | GitGraph Icon |
| **Repository Browser** | ✅ Yes - integrated via GitHub API | ❌ No |
| **Live Validation** | ✅ App installation & permissions | ✅ Repository existence & issues enabled |
| **Required Fields** | 2 fields required | 5 fields required |
| **Schema Validation** | Standard text validation | Extended validation:<br/>• URL format<br/>• Regex for repository names<br/>• Min. 32 characters for webhook secret |

## 🔗 Backend API Structure

| Aspect | GitHub Integration | Gitea Integration |
|--------|-------------------|-------------------|
| **Verification Endpoint** | `/verify` - checks app installation | `/verify` - checks repository access |
| **Repository Listing** | ❌ Not implemented | ✅ `/repositories` - lists available repos |
| **Webhook Endpoint** | `/{projectId}/webhook` - project-specific | `/webhook` - general (extending to project-specific) |
| **Import Feature** | ✅ Import issues | ✅ Import issues |
| **API Version** | GitHub REST API v4 | Gitea API v1 |

## 🪝 Webhook Implementation

| Aspect | GitHub Integration | Gitea Integration |
|--------|-------------------|-------------------|
| **Webhook URL** | `{BASE_URL}/api/github-integration/webhook/{projectId}` | `{BASE_URL}/api/gitea-integration/webhook/{projectId}` |
| **Signature Verification** | HMAC-SHA256 with `x-hub-signature-256` | HMAC-SHA256 with `x-gitea-signature` |
| **Event Header** | `x-github-event` | `x-gitea-event` |
| **Supported Events** | Issues, Issue Comments | Issues (create, update, delete, close) |
| **Project Isolation** | ✅ Project-specific URLs | ✅ Project-specific URLs (planned) |
| **Secret Management** | Server-side via environment variables | User-defined per integration |

## 🔄 Bidirectional Synchronization

| Aspect | GitHub Integration | Gitea Integration |
|--------|-------------------|-------------------|
| **Kaneo → Repository** | ✅ Task → Issue creation | ✅ Task → Issue creation |
| **Repository → Kaneo** | ✅ Issue changes → Task updates | ✅ Issue changes → Task updates |
| **Status Mapping** | GitHub State → Kaneo Status | Gitea Labels → Kaneo Status |
| **Priority Handling** | GitHub Labels → Kaneo Priority | Gitea Labels → Kaneo Priority |
| **Label System** | Standard GitHub Labels | Configurable Gitea Labels |
| **External Links** | ✅ Automatic linking | ✅ Automatic linking |

## 📊 Features & Functionality

| Feature | GitHub Integration | Gitea Integration |
|---------|-------------------|-------------------|
| **Issue Import** | ✅ Complete | ✅ Complete |
| **Task Creation** | ✅ Automatic | ✅ Automatic |
| **Status Sync** | ✅ Bidirectional | ✅ Bidirectional |
| **Priority Sync** | ✅ Via Labels | ✅ Via Labels |
| **Comment Sync** | ⚠️ Limited | ⚠️ Planned |
| **Bulk Operations** | ✅ Multiple Issues | ✅ Multiple Issues |
| **Error Handling** | ✅ Comprehensive | ✅ Comprehensive |
| **Logging** | ✅ Debug Support | ✅ Debug Support |

## 🛡️ Security

| Aspect | GitHub Integration | Gitea Integration |
|--------|-------------------|-------------------|
| **Authentication** | GitHub App with JWT | Access Token |
| **Webhook Security** | HMAC-SHA256 (server-managed) | HMAC-SHA256 (user-managed) |
| **Token Storage** | None - via GitHub App | Encrypted in database |
| **Permission Model** | GitHub App permissions | Repository-level access |
| **Secret Length** | Predefined | Minimum 32 characters |
| **Project Isolation** | ✅ Full separation | ✅ Full separation |

## 📋 Documentation

| Aspect | GitHub Integration | Gitea Integration |
|--------|-------------------|-------------------|
| **Setup Guide** | ✅ Comprehensive (`setup.mdx`) | ✅ Comprehensive (`GITEA_INTEGRATION.md`) |
| **Configuration** | ✅ Detailed (`configuration.mdx`) | ✅ Embedded in main documentation |
| **Troubleshooting** | ✅ Dedicated section (`troubleshooting.mdx`) | ✅ Embedded in main documentation |
| **Code Examples** | ✅ Docker Compose, Kubernetes | ✅ Docker Compose, Curl examples |
| **Architecture Diagram** | ❌ Not available | ✅ Complete ASCII diagram |

## 🔧 Deployment & Maintenance

| Aspect | GitHub Integration | Gitea Integration |
|--------|-------------------|-------------------|
| **Initial Setup** | Complex - GitHub App required | Simple - UI configuration only |
| **Environment Variables** | 6 required | 0 required |
| **Scaling** | Easy - one app for all projects | Easy - token-based |
| **Maintenance** | GitHub App updates required | Minimal maintenance |
| **Multi-Instance** | Complex - separate apps | Easier - isolated tokens |

## 🎯 User Experience

| Aspect | GitHub Integration | Gitea Integration |
|--------|-------------------|-------------------|
| **Setup for End Users** | Difficult - admin setup required | Easy - self-service |
| **Repository Selection** | ✅ Repository browser | ❌ Manual entry |
| **Error Handling** | ✅ Specific error messages | ✅ Specific error messages |
| **Verification** | ✅ Check app installation | ✅ Check repository access |
| **Self-Hosted** | ❌ GitHub.com only | ✅ Fully supported |

## 📈 Advantages & Disadvantages

### GitHub Integration

**Advantages:**
- ✅ Native GitHub integration with official API
- ✅ Granular permissions via GitHub Apps
- ✅ Repository browser for easy selection
- ✅ Proven OAuth security
- ✅ Comprehensive documentation

**Disadvantages:**
- ❌ Complex setup with GitHub App creation
- ❌ Many environment variables required
- ❌ GitHub.com only
- ❌ Requires admin rights for setup

### Gitea Integration

**Advantages:**
- ✅ Simple token-based setup
- ✅ Fully self-service for end users
- ✅ Supports self-hosted Gitea instances
- ✅ Flexible webhook secret management
- ✅ No server-side environment variables

**Disadvantages:**
- ❌ No repository browser
- ❌ Token management by users
- ❌ Dependent on user permissions
- ❌ Manual webhook setup required

## 🎯 Recommendations

### When to use GitHub Integration:
- Primarily GitHub.com repositories
- Organizations with dedicated DevOps teams
- Requires granular permission control
- Repository discovery is important

### When to use Gitea Integration:
- Self-hosted Gitea instances
- Small teams or individuals
- Simple, quick integration desired
- Users should be able to configure independently

## 🔄 Migration between Integrations

Both integrations can be used in parallel as they use separate database tables and APIs. A project can only have one integration at a time, but different projects can use different integrations.
