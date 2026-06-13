import { minimatch } from "minimatch";
import type { ArchitectureIndex } from "@arch4/core";

export function elementsForFiles(
  index: ArchitectureIndex,
  files: string[],
): ArchitectureIndex["elements"] {
  return index.elements.filter((element) =>
    files.some((file) =>
      element.paths.some((glob) => minimatch(file, glob, { dot: true })),
    ),
  );
}

export function renderContextMarkdown(
  elements: ArchitectureIndex["elements"],
  files: string[],
): string {
  const lines = ["# Arch4 Context", ""];
  if (files.length) {
    lines.push("## Source Files", "", ...files.map((file) => `- ${file}`), "");
  }
  if (!elements.length) {
    lines.push("No mapped architecture elements found.");
    return `${lines.join("\n")}\n`;
  }
  elements.forEach((element) => {
    lines.push(
      `## ${element.name}`,
      "",
      `- Entity: ${element.entityId}`,
      `- Type: ${element.type ?? "unknown"}`,
    );
    if (element.description) {
      lines.push(`- Description: ${element.description}`);
    }
    if (element.tags?.length) lines.push(`- Tags: ${element.tags.join(", ")}`);
    if (element.paths.length) {
      lines.push(`- Paths: ${element.paths.join(", ")}`);
    }
    if (element.views.length) {
      lines.push(`- Views: ${element.views.join(", ")}`);
    }
    if (element.owners?.length) {
      lines.push(`- Owners: ${element.owners.join(", ")}`);
    }
    if (element.confidence) lines.push(`- Confidence: ${element.confidence}`);
    if (element.openQuestions?.length) {
      lines.push("", "Open questions:");
      element.openQuestions.forEach((question) => lines.push(`- ${question}`));
    }
    if (element.notes && Object.keys(element.notes).length) {
      lines.push(
        "",
        "Notes:",
        "```json",
        JSON.stringify(element.notes, null, 2),
        "```",
      );
    }
    if (element.contributors.length) {
      lines.push(
        "- Contributors: " +
          element.contributors
            .map((item) => `${item.name} (${item.commits})`)
            .join(", "),
      );
    }
    if (element.recentCommits.length) {
      lines.push("", "Recent commits:");
      element.recentCommits
        .slice(0, 5)
        .forEach((commit) =>
          lines.push(
            `- ${commit.date} ${commit.hash.slice(0, 8)} ${commit.subject}`,
          ),
        );
    }
    lines.push("");
  });
  return `${lines.join("\n")}\n`;
}
