import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
  integrations: [
    starlight({
      title: "Kairo Docs",
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/elhamdev/kairo" }],
      sidebar: [
        {
          label: "Start",
          items: [
            { label: "Quickstart", slug: "quickstart" },
            { label: "CLI", slug: "guides/cli" },
            { label: "Desktop", slug: "guides/desktop" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "Packages", slug: "reference/packages" },
            { label: "MCP", slug: "reference/mcp" },
          ],
        },
      ],
    }),
  ],
});
