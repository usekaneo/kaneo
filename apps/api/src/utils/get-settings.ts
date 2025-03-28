function getSettings() {
  return {
    allowRegistration:
      typeof process.env.ALLOW_REGISTRATION === "string"
        ? process.env.ALLOW_REGISTRATION === "true"
        : true,
    isDemoMode:
      typeof process.env.DEMO_MODE === "string"
        ? process.env.DEMO_MODE === "true"
        : false,
  };
}

export default getSettings;
