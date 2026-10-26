import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { MAX_AVATAR_BYTES, MAX_AVATAR_REQUEST_BYTES } from "../user/avatar";
import { uploadAvatarBody } from "../user/schema";
import { boundedRequestBody } from "../utils/bounded-request-body";
import { requireInstanceAdmin } from "../utils/require-instance-admin";
import { requireUserSession } from "../utils/require-user-session";
import { adminAuditRequest } from "./audit/admin-audit-request";
import createUser from "./controllers/create-user";
import markEmailVerified from "./controllers/mark-email-verified";
import removeUserAvatar from "./controllers/remove-user-avatar";
import sendPasswordResetEmail from "./controllers/send-password-reset-email";
import sendVerificationEmail from "./controllers/send-verification-email";
import setUserAvatar from "./controllers/set-user-avatar";
import {
  adminEmailSentSchema,
  adminEmailVerifiedSchema,
  adminUserAvatarRemovedSchema,
  adminUserAvatarSchema,
  createdAdminUserSchema,
} from "./response";
import { adminUserParam, createAdminUserBody } from "./schema";

const forbidden = errorResponse(
  "The caller is not an instance administrator or is authenticated with an API key",
);
const notFound = errorResponse("User not found");
const emailErrors = {
  409: errorResponse(
    "Nothing to send: a guest account, an already verified address, or password sign-in is disabled",
  ),
  502: errorResponse("The SMTP server did not accept the email"),
  503: errorResponse("Email delivery is not configured on this instance"),
};

const createUserRoute = createRoute({
  method: "post",
  operationId: "createAdminUser",
  path: "/",
  tags: ["Admin"],
  summary: "Create a user",
  description:
    "Create an account with an instance role. No password is set or returned. When password sign-in is available, the user is emailed a single-use link, valid for 2 days, to choose their own password. When password registration or the login form is disabled, the account is created with a verified email so the user can sign in with single sign-on, and no email is sent. Registration restrictions do not apply to administrators.",
  middleware: [requireUserSession, requireInstanceAdmin] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createAdminUserBody } },
    },
  },
  responses: {
    201: jsonResponse("The new user", createdAdminUserSchema),
    400: errorResponse("Invalid name, email, or role, or a disposable address"),
    403: forbidden,
    409: errorResponse("A user with this email already exists"),
  },
});

const sendPasswordResetRoute = createRoute({
  method: "post",
  operationId: "sendAdminUserPasswordReset",
  path: "/{userId}/password-reset-email",
  tags: ["Admin"],
  summary: "Email a password reset link",
  description:
    "Email the user a single-use link to choose a new password, using the regular reset lifetime. The link is never returned to the administrator.",
  middleware: [requireUserSession, requireInstanceAdmin] as const,
  request: { params: adminUserParam },
  responses: {
    200: jsonResponse("The email was sent", adminEmailSentSchema),
    403: forbidden,
    404: notFound,
    ...emailErrors,
  },
});

const sendVerificationRoute = createRoute({
  method: "post",
  operationId: "sendAdminUserVerificationEmail",
  path: "/{userId}/verification-email",
  tags: ["Admin"],
  summary: "Email a verification link",
  description:
    "Email the user a link, valid for 24 hours, that confirms their email address. The link is never returned to the administrator.",
  middleware: [requireUserSession, requireInstanceAdmin] as const,
  request: { params: adminUserParam },
  responses: {
    200: jsonResponse("The email was sent", adminEmailSentSchema),
    403: forbidden,
    404: notFound,
    ...emailErrors,
  },
});

const markEmailVerifiedRoute = createRoute({
  method: "put",
  operationId: "markAdminUserEmailVerified",
  path: "/{userId}/email-verified",
  tags: ["Admin"],
  summary: "Mark an email as verified",
  description:
    "Mark the user's email address as verified without asking them, for example so a single sign-on identity with the same address can link to the account.",
  middleware: [requireUserSession, requireInstanceAdmin] as const,
  request: { params: adminUserParam },
  responses: {
    200: jsonResponse("The email is verified", adminEmailVerifiedSchema),
    403: forbidden,
    404: notFound,
  },
});

const setAvatarRoute = createRoute({
  method: "put",
  operationId: "setAdminUserAvatar",
  path: "/{userId}/avatar",
  tags: ["Admin"],
  summary: "Set a user's avatar",
  description: `Store a base64 encoded avatar (PNG, JPEG, or WebP, up to ${Math.floor(
    MAX_AVATAR_BYTES / 1024,
  )}KB) for the user and make it their profile picture. Not available when the identity provider manages the user's picture.`,
  middleware: [
    requireUserSession,
    requireInstanceAdmin,
    boundedRequestBody(MAX_AVATAR_REQUEST_BYTES),
  ] as const,
  request: {
    params: adminUserParam,
    body: {
      required: true,
      content: { "application/json": { schema: uploadAvatarBody } },
    },
  },
  responses: {
    200: jsonResponse("The new picture", adminUserAvatarSchema),
    400: errorResponse("Unsupported, invalid, or oversized image"),
    403: errorResponse(
      "Not an instance administrator, an API key, or the picture is managed by the identity provider",
    ),
    404: notFound,
    413: errorResponse("Request body is too large"),
  },
});

const removeAvatarRoute = createRoute({
  method: "delete",
  operationId: "removeAdminUserAvatar",
  path: "/{userId}/avatar",
  tags: ["Admin"],
  summary: "Remove a user's avatar",
  description:
    "Remove the user's profile picture. A picture managed by the identity provider can't be removed, but an earlier Kaneo upload can.",
  middleware: [requireUserSession, requireInstanceAdmin] as const,
  request: { params: adminUserParam },
  responses: {
    200: jsonResponse("Picture removed", adminUserAvatarRemovedSchema),
    403: errorResponse(
      "Not an instance administrator, an API key, or the picture is managed by the identity provider",
    ),
    404: notFound,
  },
});

const adminUserRoutes = apiRouter()
  .openapi(createUserRoute, async (c) =>
    c.json(await createUser(c.req.valid("json"), adminAuditRequest(c)), 201),
  )
  .openapi(sendPasswordResetRoute, async (c) =>
    c.json(
      await sendPasswordResetEmail(
        c.req.valid("param").userId,
        adminAuditRequest(c),
      ),
      200,
    ),
  )
  .openapi(sendVerificationRoute, async (c) =>
    c.json(
      await sendVerificationEmail(
        c.req.valid("param").userId,
        adminAuditRequest(c),
      ),
      200,
    ),
  )
  .openapi(markEmailVerifiedRoute, async (c) =>
    c.json(
      await markEmailVerified(
        c.req.valid("param").userId,
        adminAuditRequest(c),
      ),
      200,
    ),
  )
  .openapi(setAvatarRoute, async (c) =>
    c.json(
      await setUserAvatar(
        { userId: c.req.valid("param").userId, ...c.req.valid("json") },
        adminAuditRequest(c),
      ),
      200,
    ),
  )
  .openapi(removeAvatarRoute, async (c) =>
    c.json(
      await removeUserAvatar(c.req.valid("param").userId, adminAuditRequest(c)),
      200,
    ),
  );

export default adminUserRoutes;
