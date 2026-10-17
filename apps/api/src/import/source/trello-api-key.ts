export function trelloApiKeyFromEnv(env: NodeJS.ProcessEnv = process.env) {
  return env.TRELLO_API_KEY?.trim() || null;
}
