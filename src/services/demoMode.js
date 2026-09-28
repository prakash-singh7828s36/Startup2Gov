const viteEnv = import.meta.env;
export const DEMO_MODE =
  viteEnv?.PROD !== true &&
  String(viteEnv?.VITE_DEMO_MODE ?? "false").toLowerCase() === "true";

export function canUseDemoFallback(feature, error) {
  if (!DEMO_MODE) {
    return false;
  }

  console.warn(`[demo-mode] Using local fallback for ${feature}.`, error);
  return true;
}