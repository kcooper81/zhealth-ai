/**
 * Simple markdown renderer — no external dependencies.
 * Returns sanitised HTML from a subset of Markdown.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderInline(line: string): string {
  // Bold
  line = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  line = line.replace(/__(.+?)__/g, "<strong>$1</strong>");
  // Italic
  line = line.replace(/\*(.+?)\*/g, "<em>$1</em>");
  line = line.replace(/_(.+?)_/g, "<em>$1</em>");
  // Inline code
  line = line.replace(
    /`([^`]+)`/g,
    '<code class="inline-code">$1</code>'
  );
  // Links
  line = line.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1</a>'
  );
  return line;
}

export function renderMarkdown(text: string): string {
  // Escape HTML entities first, then apply markdown rules
  const escaped = escapeHtml(text);
  const lines = escaped.split("\n");
  const result: string[] = [];
  let inCodeBlock = false;
  let codeBlockLang = "";
  let codeBlockLines: string[] = [];
  let inList = false;
  let inOrderedList = false;
  let inTable = false;
  let tableRows: string[][] = [];
  let tableAligns: string[] = [];

  const flushList = () => {
    if (inList) {
      result.push("</ul>");
      inList = false;
    }
  };

  const flushOrderedList = () => {
    if (inOrderedList) {
      result.push("</ol>");
      inOrderedList = false;
    }
  };

  const flushTable = () => {
    if (inTable && tableRows.length > 0) {
      let html = '<div class="md-table-wrapper"><table class="md-table"><thead><tr>';
      const headers = tableRows[0];
      for (const h of headers) {
        html += `<th>${renderInline(h.trim())}</th>`;
      }
      html += "</tr></thead><tbody>";
      for (let i = 1; i < tableRows.length; i++) {
        html += "<tr>";
        for (let j = 0; j < tableRows[i].length; j++) {
          const align = tableAligns[j] || "";
          const style = align ? ` style="text-align:${align}"` : "";
          html += `<td${style}>${renderInline(tableRows[i][j].trim())}</td>`;
        }
        html += "</tr>";
      }
      html += "</tbody></table></div>";
      result.push(html);
      tableRows = [];
      tableAligns = [];
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith("```")) {
      if (!inCodeBlock) {
        flushList();
        flushOrderedList();
        flushTable();
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
        codeBlockLines = [];
        continue;
      } else {
        const langLabel = codeBlockLang
          ? `<span class="code-lang">${codeBlockLang}</span>`
          : "";
        const copyBtn =
          '<button class="code-copy-btn" onclick="navigator.clipboard.writeText(this.parentElement.querySelector(\'code\').textContent)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>';
        result.push(
          `<div class="code-block"><div class="code-block-header">${langLabel}${copyBtn}</div><pre><code class="language-${codeBlockLang}">${codeBlockLines.join("\n")}</code></pre></div>`
        );
        inCodeBlock = false;
        codeBlockLang = "";
        codeBlockLines = [];
        continue;
      }
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
      flushList();
      flushOrderedList();
      flushTable();
      result.push('<hr class="md-hr" />');
      continue;
    }

    // Table detection
    if (line.includes("|") && line.trim().startsWith("|")) {
      const cells = line
        .split("|")
        .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

      // Check if this is a separator row (---|---|---)
      if (cells.every((c) => /^[\s:]*-+[\s:]*$/.test(c))) {
        // Parse alignment
        tableAligns = cells.map((c) => {
          const trimmed = c.trim();
          if (trimmed.startsWith(":") && trimmed.endsWith(":")) return "center";
          if (trimmed.endsWith(":")) return "right";
          return "left";
        });
        continue;
      }

      if (!inTable) {
        flushList();
        flushOrderedList();
        inTable = true;
        tableRows = [];
      }
      tableRows.push(cells);
      continue;
    } else {
      flushTable();
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushList();
      flushOrderedList();
      const level = headingMatch[1].length;
      result.push(
        `<h${level} class="md-h${level}">${renderInline(headingMatch[2])}</h${level}>`
      );
      continue;
    }

    // Blockquote
    if (line.startsWith("&gt; ") || line === "&gt;") {
      flushList();
      flushOrderedList();
      const content = line.replace(/^&gt;\s?/, "");
      result.push(
        `<blockquote class="md-blockquote">${renderInline(content)}</blockquote>`
      );
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      flushOrderedList();
      if (!inList) {
        flushTable();
        inList = true;
        result.push('<ul class="md-list">');
      }
      const content = line.replace(/^[-*]\s+/, "");
      result.push(`<li>${renderInline(content)}</li>`);
      continue;
    } else {
      flushList();
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      flushList();
      if (!inOrderedList) {
        flushTable();
        inOrderedList = true;
        result.push('<ol class="md-list md-ol">');
      }
      const content = line.replace(/^\d+\.\s+/, "");
      result.push(`<li>${renderInline(content)}</li>`);
      continue;
    } else {
      flushOrderedList();
    }

    // Empty line
    if (line.trim() === "") {
      flushList();
      flushOrderedList();
      flushTable();
      continue;
    }

    // Regular paragraph
    result.push(`<p class="md-p">${renderInline(line)}</p>`);
  }

  // Flush any trailing open blocks
  if (inCodeBlock && codeBlockLines.length > 0) {
    result.push(
      `<div class="code-block"><pre><code>${codeBlockLines.join("\n")}</code></pre></div>`
    );
  }
  flushList();
  flushOrderedList();
  flushTable();

  return result.join("\n");
}
