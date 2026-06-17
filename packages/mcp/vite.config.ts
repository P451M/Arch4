import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "src/widget",
  build: {
    emptyOutDir: false,
    outDir: "../../dist/widget",
  },
});
