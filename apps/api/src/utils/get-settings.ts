import dotenv from "dotenv";

dotenv.config();

function getSettings() {
  return {
    disableRegistration: process.env.DISABLE_REGISTRATION === "true",
    isDemoMode: process.env.DEMO_MODE === "true",
  };
}

export default getSettings;
