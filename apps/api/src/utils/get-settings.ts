function getSettings() {
  return {
    allowRegistration:
      typeof process.env.DISABLE_REGISTRATION === "string"
        ? process.env.DISABLE_REGISTRATION === "true"
        : false,
    isDemoMode:
      typeof process.env.DEMO_MODE === "string"
        ? process.env.DEMO_MODE === "true"
        : false,
  };
}

export default getSettings;
