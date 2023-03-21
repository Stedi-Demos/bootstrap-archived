import dotenv from "dotenv";

export const requiredEnvVar = (key: string): string => {
  dotenv.config({ override: true, path: process.env.DOTENV_CONFIG_PATH });

  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};
