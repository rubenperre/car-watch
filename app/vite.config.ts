import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// GitHub Pages serves the site under /car-watch/, so CI sets VITE_BASE=/car-watch/.
export default defineConfig(({ mode }) => ({
  base: loadEnv(mode, ".", "VITE_").VITE_BASE || "/",
  plugins: [react()],
}));
