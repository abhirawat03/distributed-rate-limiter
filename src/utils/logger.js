const isProd = process.env.NODE_ENV === "production";

export const logger = {
  info: (message, meta = {}) => {
    if (isProd) {
      console.log(
        JSON.stringify({
          level: "info",
          timestamp: new Date().toISOString(),
          message,
          ...meta,
        }),
      );
    } else {
      console.log(`[INFO] ${message}`, Object.keys(meta).length ? meta : "");
    }
  },
  warn: (message, error, meta = {}) => {
    const errorMsg = error?.message || error;
    if (isProd) {
      console.warn(
        JSON.stringify({
          level: "warn",
          timestamp: new Date().toISOString(),
          message,
          error: errorMsg,
          ...meta,
        }),
      );
    } else {
      console.warn(
        `[WARN] ⚠️ ${message}`,
        error ? `(${errorMsg})` : "",
        Object.keys(meta).length ? meta : "",
      );
    }
  },
};
