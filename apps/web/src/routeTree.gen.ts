/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file was automatically generated by TanStack Router.
// You should NOT make any changes in this file as it will be overwritten.
// Additionally, you should also exclude this file from your linter and/or formatter to prevent it from being checked or modified.

import { createFileRoute } from '@tanstack/react-router'

// Import Routes

import { Route as rootRoute } from './routes/__root'
import { Route as DashboardImport } from './routes/dashboard'
import { Route as IndexImport } from './routes/index'
import { Route as DashboardSettingsImport } from './routes/dashboard/settings'
import { Route as AuthSignUpImport } from './routes/auth/sign-up'
import { Route as AuthSignInImport } from './routes/auth/sign-in'
import { Route as DashboardWorkspaceWorkspaceIdImport } from './routes/dashboard/workspace/$workspaceId'
import { Route as DashboardSettingsAppearanceImport } from './routes/dashboard/settings/appearance'
import { Route as DashboardTeamsWorkspaceIdLayoutImport } from './routes/dashboard/teams/$workspaceId/_layout'
import { Route as DashboardWorkspaceWorkspaceIdProjectProjectIdImport } from './routes/dashboard/workspace/$workspaceId/project/$projectId'
import { Route as DashboardTeamsWorkspaceIdLayoutRolesImport } from './routes/dashboard/teams/$workspaceId/_layout.roles'
import { Route as DashboardTeamsWorkspaceIdLayoutMembersImport } from './routes/dashboard/teams/$workspaceId/_layout.members'
import { Route as DashboardTeamsWorkspaceIdLayoutInvitationsImport } from './routes/dashboard/teams/$workspaceId/_layout.invitations'
import { Route as DashboardWorkspaceWorkspaceIdProjectProjectIdBoardImport } from './routes/dashboard/workspace/$workspaceId/project/$projectId/board'
import { Route as DashboardWorkspaceWorkspaceIdProjectProjectIdTaskTaskIdImport } from './routes/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId'

// Create Virtual Routes

const DashboardTeamsWorkspaceIdImport = createFileRoute(
  '/dashboard/teams/$workspaceId',
)()

// Create/Update Routes

const DashboardRoute = DashboardImport.update({
  id: '/dashboard',
  path: '/dashboard',
  getParentRoute: () => rootRoute,
} as any)

const IndexRoute = IndexImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRoute,
} as any)

const DashboardSettingsRoute = DashboardSettingsImport.update({
  id: '/settings',
  path: '/settings',
  getParentRoute: () => DashboardRoute,
} as any)

const AuthSignUpRoute = AuthSignUpImport.update({
  id: '/auth/sign-up',
  path: '/auth/sign-up',
  getParentRoute: () => rootRoute,
} as any)

const AuthSignInRoute = AuthSignInImport.update({
  id: '/auth/sign-in',
  path: '/auth/sign-in',
  getParentRoute: () => rootRoute,
} as any)

const DashboardTeamsWorkspaceIdRoute = DashboardTeamsWorkspaceIdImport.update({
  id: '/teams/$workspaceId',
  path: '/teams/$workspaceId',
  getParentRoute: () => DashboardRoute,
} as any)

const DashboardWorkspaceWorkspaceIdRoute =
  DashboardWorkspaceWorkspaceIdImport.update({
    id: '/workspace/$workspaceId',
    path: '/workspace/$workspaceId',
    getParentRoute: () => DashboardRoute,
  } as any)

const DashboardSettingsAppearanceRoute =
  DashboardSettingsAppearanceImport.update({
    id: '/appearance',
    path: '/appearance',
    getParentRoute: () => DashboardSettingsRoute,
  } as any)

const DashboardTeamsWorkspaceIdLayoutRoute =
  DashboardTeamsWorkspaceIdLayoutImport.update({
    id: '/_layout',
    getParentRoute: () => DashboardTeamsWorkspaceIdRoute,
  } as any)

const DashboardWorkspaceWorkspaceIdProjectProjectIdRoute =
  DashboardWorkspaceWorkspaceIdProjectProjectIdImport.update({
    id: '/project/$projectId',
    path: '/project/$projectId',
    getParentRoute: () => DashboardWorkspaceWorkspaceIdRoute,
  } as any)

const DashboardTeamsWorkspaceIdLayoutRolesRoute =
  DashboardTeamsWorkspaceIdLayoutRolesImport.update({
    id: '/roles',
    path: '/roles',
    getParentRoute: () => DashboardTeamsWorkspaceIdLayoutRoute,
  } as any)

const DashboardTeamsWorkspaceIdLayoutMembersRoute =
  DashboardTeamsWorkspaceIdLayoutMembersImport.update({
    id: '/members',
    path: '/members',
    getParentRoute: () => DashboardTeamsWorkspaceIdLayoutRoute,
  } as any)

const DashboardTeamsWorkspaceIdLayoutInvitationsRoute =
  DashboardTeamsWorkspaceIdLayoutInvitationsImport.update({
    id: '/invitations',
    path: '/invitations',
    getParentRoute: () => DashboardTeamsWorkspaceIdLayoutRoute,
  } as any)

const DashboardWorkspaceWorkspaceIdProjectProjectIdBoardRoute =
  DashboardWorkspaceWorkspaceIdProjectProjectIdBoardImport.update({
    id: '/board',
    path: '/board',
    getParentRoute: () => DashboardWorkspaceWorkspaceIdProjectProjectIdRoute,
  } as any)

const DashboardWorkspaceWorkspaceIdProjectProjectIdTaskTaskIdRoute =
  DashboardWorkspaceWorkspaceIdProjectProjectIdTaskTaskIdImport.update({
    id: '/task/$taskId',
    path: '/task/$taskId',
    getParentRoute: () => DashboardWorkspaceWorkspaceIdProjectProjectIdRoute,
  } as any)

// Populate the FileRoutesByPath interface

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexImport
      parentRoute: typeof rootRoute
    }
    '/dashboard': {
      id: '/dashboard'
      path: '/dashboard'
      fullPath: '/dashboard'
      preLoaderRoute: typeof DashboardImport
      parentRoute: typeof rootRoute
    }
    '/auth/sign-in': {
      id: '/auth/sign-in'
      path: '/auth/sign-in'
      fullPath: '/auth/sign-in'
      preLoaderRoute: typeof AuthSignInImport
      parentRoute: typeof rootRoute
    }
    '/auth/sign-up': {
      id: '/auth/sign-up'
      path: '/auth/sign-up'
      fullPath: '/auth/sign-up'
      preLoaderRoute: typeof AuthSignUpImport
      parentRoute: typeof rootRoute
    }
    '/dashboard/settings': {
      id: '/dashboard/settings'
      path: '/settings'
      fullPath: '/dashboard/settings'
      preLoaderRoute: typeof DashboardSettingsImport
      parentRoute: typeof DashboardImport
    }
    '/dashboard/settings/appearance': {
      id: '/dashboard/settings/appearance'
      path: '/appearance'
      fullPath: '/dashboard/settings/appearance'
      preLoaderRoute: typeof DashboardSettingsAppearanceImport
      parentRoute: typeof DashboardSettingsImport
    }
    '/dashboard/workspace/$workspaceId': {
      id: '/dashboard/workspace/$workspaceId'
      path: '/workspace/$workspaceId'
      fullPath: '/dashboard/workspace/$workspaceId'
      preLoaderRoute: typeof DashboardWorkspaceWorkspaceIdImport
      parentRoute: typeof DashboardImport
    }
    '/dashboard/teams/$workspaceId': {
      id: '/dashboard/teams/$workspaceId'
      path: '/teams/$workspaceId'
      fullPath: '/dashboard/teams/$workspaceId'
      preLoaderRoute: typeof DashboardTeamsWorkspaceIdImport
      parentRoute: typeof DashboardImport
    }
    '/dashboard/teams/$workspaceId/_layout': {
      id: '/dashboard/teams/$workspaceId/_layout'
      path: '/teams/$workspaceId'
      fullPath: '/dashboard/teams/$workspaceId'
      preLoaderRoute: typeof DashboardTeamsWorkspaceIdLayoutImport
      parentRoute: typeof DashboardTeamsWorkspaceIdRoute
    }
    '/dashboard/teams/$workspaceId/_layout/invitations': {
      id: '/dashboard/teams/$workspaceId/_layout/invitations'
      path: '/invitations'
      fullPath: '/dashboard/teams/$workspaceId/invitations'
      preLoaderRoute: typeof DashboardTeamsWorkspaceIdLayoutInvitationsImport
      parentRoute: typeof DashboardTeamsWorkspaceIdLayoutImport
    }
    '/dashboard/teams/$workspaceId/_layout/members': {
      id: '/dashboard/teams/$workspaceId/_layout/members'
      path: '/members'
      fullPath: '/dashboard/teams/$workspaceId/members'
      preLoaderRoute: typeof DashboardTeamsWorkspaceIdLayoutMembersImport
      parentRoute: typeof DashboardTeamsWorkspaceIdLayoutImport
    }
    '/dashboard/teams/$workspaceId/_layout/roles': {
      id: '/dashboard/teams/$workspaceId/_layout/roles'
      path: '/roles'
      fullPath: '/dashboard/teams/$workspaceId/roles'
      preLoaderRoute: typeof DashboardTeamsWorkspaceIdLayoutRolesImport
      parentRoute: typeof DashboardTeamsWorkspaceIdLayoutImport
    }
    '/dashboard/workspace/$workspaceId/project/$projectId': {
      id: '/dashboard/workspace/$workspaceId/project/$projectId'
      path: '/project/$projectId'
      fullPath: '/dashboard/workspace/$workspaceId/project/$projectId'
      preLoaderRoute: typeof DashboardWorkspaceWorkspaceIdProjectProjectIdImport
      parentRoute: typeof DashboardWorkspaceWorkspaceIdImport
    }
    '/dashboard/workspace/$workspaceId/project/$projectId/board': {
      id: '/dashboard/workspace/$workspaceId/project/$projectId/board'
      path: '/board'
      fullPath: '/dashboard/workspace/$workspaceId/project/$projectId/board'
      preLoaderRoute: typeof DashboardWorkspaceWorkspaceIdProjectProjectIdBoardImport
      parentRoute: typeof DashboardWorkspaceWorkspaceIdProjectProjectIdImport
    }
    '/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId': {
      id: '/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId'
      path: '/task/$taskId'
      fullPath: '/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId'
      preLoaderRoute: typeof DashboardWorkspaceWorkspaceIdProjectProjectIdTaskTaskIdImport
      parentRoute: typeof DashboardWorkspaceWorkspaceIdProjectProjectIdImport
    }
  }
}

// Create and export the route tree

interface DashboardSettingsRouteChildren {
  DashboardSettingsAppearanceRoute: typeof DashboardSettingsAppearanceRoute
}

const DashboardSettingsRouteChildren: DashboardSettingsRouteChildren = {
  DashboardSettingsAppearanceRoute: DashboardSettingsAppearanceRoute,
}

const DashboardSettingsRouteWithChildren =
  DashboardSettingsRoute._addFileChildren(DashboardSettingsRouteChildren)

interface DashboardWorkspaceWorkspaceIdProjectProjectIdRouteChildren {
  DashboardWorkspaceWorkspaceIdProjectProjectIdBoardRoute: typeof DashboardWorkspaceWorkspaceIdProjectProjectIdBoardRoute
  DashboardWorkspaceWorkspaceIdProjectProjectIdTaskTaskIdRoute: typeof DashboardWorkspaceWorkspaceIdProjectProjectIdTaskTaskIdRoute
}

const DashboardWorkspaceWorkspaceIdProjectProjectIdRouteChildren: DashboardWorkspaceWorkspaceIdProjectProjectIdRouteChildren =
  {
    DashboardWorkspaceWorkspaceIdProjectProjectIdBoardRoute:
      DashboardWorkspaceWorkspaceIdProjectProjectIdBoardRoute,
    DashboardWorkspaceWorkspaceIdProjectProjectIdTaskTaskIdRoute:
      DashboardWorkspaceWorkspaceIdProjectProjectIdTaskTaskIdRoute,
  }

const DashboardWorkspaceWorkspaceIdProjectProjectIdRouteWithChildren =
  DashboardWorkspaceWorkspaceIdProjectProjectIdRoute._addFileChildren(
    DashboardWorkspaceWorkspaceIdProjectProjectIdRouteChildren,
  )

interface DashboardWorkspaceWorkspaceIdRouteChildren {
  DashboardWorkspaceWorkspaceIdProjectProjectIdRoute: typeof DashboardWorkspaceWorkspaceIdProjectProjectIdRouteWithChildren
}

const DashboardWorkspaceWorkspaceIdRouteChildren: DashboardWorkspaceWorkspaceIdRouteChildren =
  {
    DashboardWorkspaceWorkspaceIdProjectProjectIdRoute:
      DashboardWorkspaceWorkspaceIdProjectProjectIdRouteWithChildren,
  }

const DashboardWorkspaceWorkspaceIdRouteWithChildren =
  DashboardWorkspaceWorkspaceIdRoute._addFileChildren(
    DashboardWorkspaceWorkspaceIdRouteChildren,
  )

interface DashboardTeamsWorkspaceIdLayoutRouteChildren {
  DashboardTeamsWorkspaceIdLayoutInvitationsRoute: typeof DashboardTeamsWorkspaceIdLayoutInvitationsRoute
  DashboardTeamsWorkspaceIdLayoutMembersRoute: typeof DashboardTeamsWorkspaceIdLayoutMembersRoute
  DashboardTeamsWorkspaceIdLayoutRolesRoute: typeof DashboardTeamsWorkspaceIdLayoutRolesRoute
}

const DashboardTeamsWorkspaceIdLayoutRouteChildren: DashboardTeamsWorkspaceIdLayoutRouteChildren =
  {
    DashboardTeamsWorkspaceIdLayoutInvitationsRoute:
      DashboardTeamsWorkspaceIdLayoutInvitationsRoute,
    DashboardTeamsWorkspaceIdLayoutMembersRoute:
      DashboardTeamsWorkspaceIdLayoutMembersRoute,
    DashboardTeamsWorkspaceIdLayoutRolesRoute:
      DashboardTeamsWorkspaceIdLayoutRolesRoute,
  }

const DashboardTeamsWorkspaceIdLayoutRouteWithChildren =
  DashboardTeamsWorkspaceIdLayoutRoute._addFileChildren(
    DashboardTeamsWorkspaceIdLayoutRouteChildren,
  )

interface DashboardTeamsWorkspaceIdRouteChildren {
  DashboardTeamsWorkspaceIdLayoutRoute: typeof DashboardTeamsWorkspaceIdLayoutRouteWithChildren
}

const DashboardTeamsWorkspaceIdRouteChildren: DashboardTeamsWorkspaceIdRouteChildren =
  {
    DashboardTeamsWorkspaceIdLayoutRoute:
      DashboardTeamsWorkspaceIdLayoutRouteWithChildren,
  }

const DashboardTeamsWorkspaceIdRouteWithChildren =
  DashboardTeamsWorkspaceIdRoute._addFileChildren(
    DashboardTeamsWorkspaceIdRouteChildren,
  )

interface DashboardRouteChildren {
  DashboardSettingsRoute: typeof DashboardSettingsRouteWithChildren
  DashboardWorkspaceWorkspaceIdRoute: typeof DashboardWorkspaceWorkspaceIdRouteWithChildren
  DashboardTeamsWorkspaceIdRoute: typeof DashboardTeamsWorkspaceIdRouteWithChildren
}

const DashboardRouteChildren: DashboardRouteChildren = {
  DashboardSettingsRoute: DashboardSettingsRouteWithChildren,
  DashboardWorkspaceWorkspaceIdRoute:
    DashboardWorkspaceWorkspaceIdRouteWithChildren,
  DashboardTeamsWorkspaceIdRoute: DashboardTeamsWorkspaceIdRouteWithChildren,
}

const DashboardRouteWithChildren = DashboardRoute._addFileChildren(
  DashboardRouteChildren,
)

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/dashboard': typeof DashboardRouteWithChildren
  '/auth/sign-in': typeof AuthSignInRoute
  '/auth/sign-up': typeof AuthSignUpRoute
  '/dashboard/settings': typeof DashboardSettingsRouteWithChildren
  '/dashboard/settings/appearance': typeof DashboardSettingsAppearanceRoute
  '/dashboard/workspace/$workspaceId': typeof DashboardWorkspaceWorkspaceIdRouteWithChildren
  '/dashboard/teams/$workspaceId': typeof DashboardTeamsWorkspaceIdLayoutRouteWithChildren
  '/dashboard/teams/$workspaceId/invitations': typeof DashboardTeamsWorkspaceIdLayoutInvitationsRoute
  '/dashboard/teams/$workspaceId/members': typeof DashboardTeamsWorkspaceIdLayoutMembersRoute
  '/dashboard/teams/$workspaceId/roles': typeof DashboardTeamsWorkspaceIdLayoutRolesRoute
  '/dashboard/workspace/$workspaceId/project/$projectId': typeof DashboardWorkspaceWorkspaceIdProjectProjectIdRouteWithChildren
  '/dashboard/workspace/$workspaceId/project/$projectId/board': typeof DashboardWorkspaceWorkspaceIdProjectProjectIdBoardRoute
  '/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId': typeof DashboardWorkspaceWorkspaceIdProjectProjectIdTaskTaskIdRoute
}

export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/dashboard': typeof DashboardRouteWithChildren
  '/auth/sign-in': typeof AuthSignInRoute
  '/auth/sign-up': typeof AuthSignUpRoute
  '/dashboard/settings': typeof DashboardSettingsRouteWithChildren
  '/dashboard/settings/appearance': typeof DashboardSettingsAppearanceRoute
  '/dashboard/workspace/$workspaceId': typeof DashboardWorkspaceWorkspaceIdRouteWithChildren
  '/dashboard/teams/$workspaceId': typeof DashboardTeamsWorkspaceIdLayoutRouteWithChildren
  '/dashboard/teams/$workspaceId/invitations': typeof DashboardTeamsWorkspaceIdLayoutInvitationsRoute
  '/dashboard/teams/$workspaceId/members': typeof DashboardTeamsWorkspaceIdLayoutMembersRoute
  '/dashboard/teams/$workspaceId/roles': typeof DashboardTeamsWorkspaceIdLayoutRolesRoute
  '/dashboard/workspace/$workspaceId/project/$projectId': typeof DashboardWorkspaceWorkspaceIdProjectProjectIdRouteWithChildren
  '/dashboard/workspace/$workspaceId/project/$projectId/board': typeof DashboardWorkspaceWorkspaceIdProjectProjectIdBoardRoute
  '/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId': typeof DashboardWorkspaceWorkspaceIdProjectProjectIdTaskTaskIdRoute
}

export interface FileRoutesById {
  __root__: typeof rootRoute
  '/': typeof IndexRoute
  '/dashboard': typeof DashboardRouteWithChildren
  '/auth/sign-in': typeof AuthSignInRoute
  '/auth/sign-up': typeof AuthSignUpRoute
  '/dashboard/settings': typeof DashboardSettingsRouteWithChildren
  '/dashboard/settings/appearance': typeof DashboardSettingsAppearanceRoute
  '/dashboard/workspace/$workspaceId': typeof DashboardWorkspaceWorkspaceIdRouteWithChildren
  '/dashboard/teams/$workspaceId': typeof DashboardTeamsWorkspaceIdRouteWithChildren
  '/dashboard/teams/$workspaceId/_layout': typeof DashboardTeamsWorkspaceIdLayoutRouteWithChildren
  '/dashboard/teams/$workspaceId/_layout/invitations': typeof DashboardTeamsWorkspaceIdLayoutInvitationsRoute
  '/dashboard/teams/$workspaceId/_layout/members': typeof DashboardTeamsWorkspaceIdLayoutMembersRoute
  '/dashboard/teams/$workspaceId/_layout/roles': typeof DashboardTeamsWorkspaceIdLayoutRolesRoute
  '/dashboard/workspace/$workspaceId/project/$projectId': typeof DashboardWorkspaceWorkspaceIdProjectProjectIdRouteWithChildren
  '/dashboard/workspace/$workspaceId/project/$projectId/board': typeof DashboardWorkspaceWorkspaceIdProjectProjectIdBoardRoute
  '/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId': typeof DashboardWorkspaceWorkspaceIdProjectProjectIdTaskTaskIdRoute
}

export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths:
    | '/'
    | '/dashboard'
    | '/auth/sign-in'
    | '/auth/sign-up'
    | '/dashboard/settings'
    | '/dashboard/settings/appearance'
    | '/dashboard/workspace/$workspaceId'
    | '/dashboard/teams/$workspaceId'
    | '/dashboard/teams/$workspaceId/invitations'
    | '/dashboard/teams/$workspaceId/members'
    | '/dashboard/teams/$workspaceId/roles'
    | '/dashboard/workspace/$workspaceId/project/$projectId'
    | '/dashboard/workspace/$workspaceId/project/$projectId/board'
    | '/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId'
  fileRoutesByTo: FileRoutesByTo
  to:
    | '/'
    | '/dashboard'
    | '/auth/sign-in'
    | '/auth/sign-up'
    | '/dashboard/settings'
    | '/dashboard/settings/appearance'
    | '/dashboard/workspace/$workspaceId'
    | '/dashboard/teams/$workspaceId'
    | '/dashboard/teams/$workspaceId/invitations'
    | '/dashboard/teams/$workspaceId/members'
    | '/dashboard/teams/$workspaceId/roles'
    | '/dashboard/workspace/$workspaceId/project/$projectId'
    | '/dashboard/workspace/$workspaceId/project/$projectId/board'
    | '/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId'
  id:
    | '__root__'
    | '/'
    | '/dashboard'
    | '/auth/sign-in'
    | '/auth/sign-up'
    | '/dashboard/settings'
    | '/dashboard/settings/appearance'
    | '/dashboard/workspace/$workspaceId'
    | '/dashboard/teams/$workspaceId'
    | '/dashboard/teams/$workspaceId/_layout'
    | '/dashboard/teams/$workspaceId/_layout/invitations'
    | '/dashboard/teams/$workspaceId/_layout/members'
    | '/dashboard/teams/$workspaceId/_layout/roles'
    | '/dashboard/workspace/$workspaceId/project/$projectId'
    | '/dashboard/workspace/$workspaceId/project/$projectId/board'
    | '/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId'
  fileRoutesById: FileRoutesById
}

export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  DashboardRoute: typeof DashboardRouteWithChildren
  AuthSignInRoute: typeof AuthSignInRoute
  AuthSignUpRoute: typeof AuthSignUpRoute
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  DashboardRoute: DashboardRouteWithChildren,
  AuthSignInRoute: AuthSignInRoute,
  AuthSignUpRoute: AuthSignUpRoute,
}

export const routeTree = rootRoute
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()

/* ROUTE_MANIFEST_START
{
  "routes": {
    "__root__": {
      "filePath": "__root.tsx",
      "children": [
        "/",
        "/dashboard",
        "/auth/sign-in",
        "/auth/sign-up"
      ]
    },
    "/": {
      "filePath": "index.tsx"
    },
    "/dashboard": {
      "filePath": "dashboard.tsx",
      "children": [
        "/dashboard/settings",
        "/dashboard/workspace/$workspaceId",
        "/dashboard/teams/$workspaceId"
      ]
    },
    "/auth/sign-in": {
      "filePath": "auth/sign-in.tsx"
    },
    "/auth/sign-up": {
      "filePath": "auth/sign-up.tsx"
    },
    "/dashboard/settings": {
      "filePath": "dashboard/settings.tsx",
      "parent": "/dashboard",
      "children": [
        "/dashboard/settings/appearance"
      ]
    },
    "/dashboard/settings/appearance": {
      "filePath": "dashboard/settings/appearance.tsx",
      "parent": "/dashboard/settings"
    },
    "/dashboard/workspace/$workspaceId": {
      "filePath": "dashboard/workspace/$workspaceId.tsx",
      "parent": "/dashboard",
      "children": [
        "/dashboard/workspace/$workspaceId/project/$projectId"
      ]
    },
    "/dashboard/teams/$workspaceId": {
      "filePath": "dashboard/teams/$workspaceId",
      "parent": "/dashboard",
      "children": [
        "/dashboard/teams/$workspaceId/_layout"
      ]
    },
    "/dashboard/teams/$workspaceId/_layout": {
      "filePath": "dashboard/teams/$workspaceId/_layout.tsx",
      "parent": "/dashboard/teams/$workspaceId",
      "children": [
        "/dashboard/teams/$workspaceId/_layout/invitations",
        "/dashboard/teams/$workspaceId/_layout/members",
        "/dashboard/teams/$workspaceId/_layout/roles"
      ]
    },
    "/dashboard/teams/$workspaceId/_layout/invitations": {
      "filePath": "dashboard/teams/$workspaceId/_layout.invitations.tsx",
      "parent": "/dashboard/teams/$workspaceId/_layout"
    },
    "/dashboard/teams/$workspaceId/_layout/members": {
      "filePath": "dashboard/teams/$workspaceId/_layout.members.tsx",
      "parent": "/dashboard/teams/$workspaceId/_layout"
    },
    "/dashboard/teams/$workspaceId/_layout/roles": {
      "filePath": "dashboard/teams/$workspaceId/_layout.roles.tsx",
      "parent": "/dashboard/teams/$workspaceId/_layout"
    },
    "/dashboard/workspace/$workspaceId/project/$projectId": {
      "filePath": "dashboard/workspace/$workspaceId/project/$projectId.tsx",
      "parent": "/dashboard/workspace/$workspaceId",
      "children": [
        "/dashboard/workspace/$workspaceId/project/$projectId/board",
        "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
      ]
    },
    "/dashboard/workspace/$workspaceId/project/$projectId/board": {
      "filePath": "dashboard/workspace/$workspaceId/project/$projectId/board.tsx",
      "parent": "/dashboard/workspace/$workspaceId/project/$projectId"
    },
    "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId": {
      "filePath": "dashboard/workspace/$workspaceId/project/$projectId/task/$taskId.tsx",
      "parent": "/dashboard/workspace/$workspaceId/project/$projectId"
    }
  }
}
ROUTE_MANIFEST_END */
