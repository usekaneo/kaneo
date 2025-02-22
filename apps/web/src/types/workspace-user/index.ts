type WorkspaceUser = {
  userEmail: string;
  userName: string | null;
  joinedAt: Date;
  status: string;
  role: string;
};

export default WorkspaceUser;
