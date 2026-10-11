export function installedRefusal(
  pluginId: string,
  official: boolean,
  configName: string,
): string {
  return official
    ? `"${pluginId}" is a built-in plugin and it is still on. Turn it off with official: { ${pluginId}: false } in ${configName} and restart Kaneo, then purge its data.`
    : `Plugin "${pluginId}" is still installed. Remove it from ${configName} and restart Kaneo, then purge its data.`;
}

export function disabledRefusal(pluginId: string): string {
  return `Plugins are turned off with DISABLE_PLUGINS=true, so Kaneo cannot tell whether "${pluginId}" is still installed. Start Kaneo with plugins on, then purge its data.`;
}
