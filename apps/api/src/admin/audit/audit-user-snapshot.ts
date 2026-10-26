/** The fields of a user account that admin audit entries compare or name. */
export type AuditUserSnapshot = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  banned: boolean | null;
  banReason: string | null;
  banExpires: Date | null;
  emailVerified: boolean;
  image: string | null;
};
