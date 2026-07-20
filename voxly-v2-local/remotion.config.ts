import { Config } from "@remotion/cli/config";

// Videos use absolute paths (OffthreadVideo) — avoid copying public/local-media (~GB) into bundle
Config.setPublicDir("./remotion-public");
