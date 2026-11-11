import {
  FileText,
  FileImage,
  File,
  FileCode,
  FileArchive,
  FileAudio,
  FileVideo,
  Braces,
} from "lucide-react";

export interface FileItem {
  id: string;
  name: string;
  type: string;
  size: number;
}

export interface NativeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  ext?: string;
  children?: NativeNode[];
}

export interface TreeNode {
  name: string;
  isDir: boolean;
  children: TreeNode[];
  file?: FileItem;
  nativePath?: string;
  size?: number;
}

export function buildTree(files: FileItem[]): TreeNode[] {
  const root: TreeNode[] = [];
  const filteredFiles = files.filter(
    (f) => !["aetheria.json", "aetheria.jsonc"].includes(f.name.toLowerCase()),
  );

  for (const file of filteredFiles) {
    const parts = file.name.replace(/\\/g, "/").split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        current.push({ name: part, isDir: false, children: [], file });
      } else {
        let existing = current.find((n) => n.name === part && n.isDir);
        if (!existing) {
          existing = { name: part, isDir: true, children: [] };
          current.push(existing);
        }
        current = existing.children;
      }
    }
  }

  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => {
      if (n.isDir) sortNodes(n.children);
    });
  };
  sortNodes(root);

  return root;
}

export function nativeToTreeNodes(nodes: NativeNode[]): TreeNode[] {
  return nodes
    .filter((n) => !["aetheria.json", "aetheria.jsonc"].includes(n.name.toLowerCase()))
    .map((n) => ({
      name: n.name,
      isDir: n.type === "directory",
      nativePath: n.path,
      size: n.size,
      children: n.children ? nativeToTreeNodes(n.children) : [],
    }));
}

export function getFileIcon(name: string) {
  const lowerName = name.toLowerCase();
  const ext = lowerName.split(".").pop() || "";

  // Excel / Spreadsheets (GridCraft)
  if (["xlsx", "xls", "xlsm", "xlsb", "csv", "tsv"].includes(ext)) {
    return (
      <img
        src="/artcraft/gridcraft/gridcraft.png"
        alt="GridCraft"
        className="w-3.5 h-3.5 object-contain rounded-xs shrink-0"
      />
    );
  }

  // Word Documents (WordCraft - Royal Blue)
  if (["docx", "doc", "rtf", "odt"].includes(ext)) {
    return (
      <img
        src="/artcraft/wordcraft/wordcraft.png"
        alt="WordCraft"
        className="w-3.5 h-3.5 object-contain rounded-xs shrink-0"
      />
    );
  }

  // Plain Text Documents (TextCraft - Ocean Teal/Cyan)
  if (["txt", "text"].includes(ext)) {
    return (
      <img
        src="/artcraft/textcraft/textcraft.svg"
        alt="TextCraft"
        className="w-3.5 h-3.5 object-contain rounded-xs shrink-0"
      />
    );
  }

  // Markdown Documents (MarkdownCraft - Slate Graphite)
  if (["md"].includes(ext)) {
    return (
      <img
        src="/artcraft/markdowncraft/markdowncraft.svg"
        alt="MarkdownCraft"
        className="w-3.5 h-3.5 object-contain rounded-xs shrink-0"
      />
    );
  }

  // PDF Documents (PdfCraft)
  if (["pdf"].includes(ext)) {
    return (
      <img
        src="/artcraft/pdfcraft/pdfcraft.png"
        alt="PdfCraft"
        className="w-3.5 h-3.5 object-contain rounded-xs shrink-0"
      />
    );
  }

  // Presentations / Slides (DeckCraft)
  if (["pptx", "ppt", "key"].includes(ext)) {
    return (
      <img
        src="/artcraft/deckcraft/deckcraft.png"
        alt="DeckCraft"
        className="w-3.5 h-3.5 object-contain rounded-xs shrink-0"
      />
    );
  }

  // Images / Media (Soft Teal / Cyan)
  if (["jpg", "jpeg", "png", "gif", "svg", "webp", "ico", "bmp", "tiff"].includes(ext)) {
    return (
      <FileImage
        className="w-3.5 h-3.5 text-teal-600/85 dark:text-teal-400/80 shrink-0"
        strokeWidth={1.5}
      />
    );
  }

  // Archives / Compressed (Soft Sand / Muted Orange)
  if (["zip", "rar", "7z", "tar", "gz", "bz2"].includes(ext)) {
    return (
      <FileArchive
        className="w-3.5 h-3.5 text-amber-600/75 dark:text-amber-300/75 shrink-0"
        strokeWidth={1.5}
      />
    );
  }

  // Audio Files (Emerald)
  if (["wav", "mp3", "ogg", "m4a", "aac", "flac", "opus"].includes(ext)) {
    return (
      <FileAudio
        className="w-3.5 h-3.5 text-emerald-400 shrink-0"
        strokeWidth={1.75}
      />
    );
  }

  // Video Files (Sky Blue)
  if (["mp4", "mov", "webm", "mkv", "avi", "m4v"].includes(ext)) {
    return (
      <FileVideo
        className="w-3.5 h-3.5 text-sky-400 shrink-0"
        strokeWidth={1.75}
      />
    );
  }

  // HTML Documents (HTML5 Orange Badge)
  if (["html", "htm"].includes(ext)) {
    return (
      <svg
        viewBox="0 0 16 16"
        className="w-3.5 h-3.5 shrink-0"
        aria-label="HTML"
      >
        <path
          d="M2 1.5h12l-1.1 11.2L8 14.5l-4.9-1.8L2 1.5z"
          fill="#E34F26"
        />
        <path
          d="M11.6 4.7H5.4l.18 1.9h5.82l-.44 4.5-2.96.88-2.96-.88-.18-2.05h1.68l.1 1.05 1.36.38 1.36-.38.18-1.9H4.82L4.4 3.2h7.36l-.16 1.5z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }

  // Stylesheets (CSS3 Blue Badge)
  if (["css", "scss", "sass", "less"].includes(ext)) {
    return (
      <svg
        viewBox="0 0 16 16"
        className="w-3.5 h-3.5 shrink-0"
        aria-label="CSS"
      >
        <path
          d="M2 1.5h12l-1.1 11.2L8 14.5l-4.9-1.8L2 1.5z"
          fill="#264DE4"
        />
        <path
          d="M4.6 4.3h6.8l-.2 1.5H7.9l.1 1.1h3l-.4 4.1-2.6.8-2.6-.8-.15-1.7h1.5l.08.85 1.17.34 1.17-.34.15-1.65H5.2l-.15-1.5h3.9l.1-1.1H4.8L4.6 4.3z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }

  // JavaScript Files (Classic JS Yellow Badge)
  if (["js", "mjs", "cjs", "jsx"].includes(ext)) {
    return (
      <svg
        viewBox="0 0 16 16"
        className="w-3.5 h-3.5 shrink-0"
        aria-label="JavaScript"
      >
        <rect x="1" y="1" width="14" height="14" rx="2.5" fill="#F7DF1E" />
        <path
          d="M7.1 7.4v4.2c0 1.25-.68 1.95-1.82 1.95-.78 0-1.3-.38-1.62-.98l1.1-.66c.2.35.42.54.78.54.42 0 .64-.2.64-.82V7.4h.92zm2.28 4.46c.35.58.78.92 1.48.92.58 0 .95-.28.95-.68 0-.48-.36-.66-1.08-.98l-.4-.18c-.94-.4-1.52-.9-1.52-1.92 0-.96.73-1.68 1.86-1.68.82 0 1.42.28 1.84 1.02l-1.02.66c-.22-.4-.47-.56-.82-.56-.38 0-.62.24-.62.56 0 .4.24.56.88.84l.4.18c1.1.48 1.7.96 1.7 2.04 0 1.14-.9 1.78-2.08 1.78-1.16 0-1.9-.54-2.28-1.3l1.02-.64-.31.88z"
          fill="#18181B"
        />
      </svg>
    );
  }

  // TypeScript Files (Classic TS Blue Badge)
  if (["ts", "tsx"].includes(ext)) {
    return (
      <svg
        viewBox="0 0 16 16"
        className="w-3.5 h-3.5 shrink-0"
        aria-label="TypeScript"
      >
        <rect x="1" y="1" width="14" height="14" rx="2.5" fill="#3178C6" />
        <path
          d="M4.2 8.2H6v5.2h1.3V8.2h1.8V7.1H4.2v1.1zm5.42 3.92c.33.5.75.8 1.38.8.52 0 .85-.24.85-.58 0-.42-.32-.58-.96-.86l-.36-.16c-.85-.36-1.36-.82-1.36-1.74 0-.86.66-1.52 1.66-1.52.74 0 1.28.24 1.66.92l-.92.6c-.2-.36-.42-.5-.74-.5-.34 0-.55.22-.55.5 0 .36.22.5.78.75l.36.16c1 .42 1.54.86 1.54 1.84 0 1.02-.8 1.6-1.88 1.6-1.04 0-1.72-.48-2.06-1.18l.92-.56-.32.93z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }

  // JSON / Config Data (Soft Warm Gold / Amber Braces)
  if (["json", "yaml", "yml", "xml", "toml"].includes(ext)) {
    return (
      <Braces
        className="w-3.5 h-3.5 text-amber-500/90 dark:text-amber-400 shrink-0"
        strokeWidth={1.75}
      />
    );
  }

  // Other Code / Scripts (Soft Lilac / Muted Violet)
  if (
    ["py", "sh", "cmd", "ps1", "sql", "rs", "go", "java", "c", "cpp"].includes(ext) ||
    lowerName.startsWith(".env") ||
    lowerName === ".gitignore"
  ) {
    return (
      <FileCode
        className="w-3.5 h-3.5 text-violet-500/85 dark:text-violet-400/80 shrink-0"
        strokeWidth={1.5}
      />
    );
  }

  // System Logs & Terminal Output (Soft Slate / Neutral)
  if (["log"].includes(ext)) {
    return (
      <FileText
        className="w-3.5 h-3.5 text-slate-500/85 dark:text-zinc-400/80 shrink-0"
        strokeWidth={1.5}
      />
    );
  }

  return <File className="w-3.5 h-3.5 text-[var(--text-dim)] shrink-0" strokeWidth={1.5} />;
}

export function formatSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
