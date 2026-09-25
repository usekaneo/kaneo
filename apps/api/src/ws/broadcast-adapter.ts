export type ProjectBroadcastMessage = {
  type: string;
  projectId: string;
  taskId?: string;
  sourceTaskId?: string;
  targetTaskId?: string;
};

export type BroadcastMessage = {
  projectId: string;
  message: ProjectBroadcastMessage;
  excludeInitiatorId?: string;
};

export type UserBroadcastMessage = {
  type: string;
  [key: string]: unknown;
};

export type UserBroadcast = {
  userId: string;
  message: UserBroadcastMessage;
  origin?: string;
};

export type BroadcastAdapter = {
  /** Publish a message to all instances watching this project */
  publish(msg: BroadcastMessage): Promise<void>;

  publishToUser(msg: UserBroadcast): Promise<void>;

  /** Subscribe to messages for delivery to local connections */
  subscribe(handler: (msg: BroadcastMessage) => void): Promise<void>;

  subscribeToUser(handler: (msg: UserBroadcast) => void): Promise<void>;

  /** Cleanup on shutdown */
  shutdown(): Promise<void>;
};
