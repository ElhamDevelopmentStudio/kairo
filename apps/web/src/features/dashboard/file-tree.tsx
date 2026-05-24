import {
  BookOpenTextIcon,
  CodeIcon,
  CssFileIcon,
  FileBracesIcon,
  FileCodeIcon,
  FileIcon,
  FolderIcon,
  HtmlFileIcon,
  NpmIcon,
  ReactIcon,
  TerminalIcon,
  TypescriptIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

import { HugeIcon } from "@/components/huge-icon";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

type FileNode = {
  children: FileNode[];
  kind: "folder" | "file";
  name: string;
  path: string;
};

type FileIconConfig = {
  className: string;
  icon: IconSvgElement;
};

const fileTypeIcons: Record<string, FileIconConfig> = {
  css: { className: "text-sky-500", icon: CssFileIcon },
  html: { className: "text-orange-500", icon: HtmlFileIcon },
  js: { className: "text-yellow-500", icon: CodeIcon },
  json: { className: "text-amber-500", icon: FileBracesIcon },
  jsx: { className: "text-cyan-500", icon: ReactIcon },
  md: { className: "text-blue-500", icon: BookOpenTextIcon },
  mdx: { className: "text-blue-500", icon: BookOpenTextIcon },
  sh: { className: "text-emerald-500", icon: TerminalIcon },
  ts: { className: "text-blue-600", icon: TypescriptIcon },
  tsx: { className: "text-cyan-500", icon: ReactIcon },
  yaml: { className: "text-purple-500", icon: FileCodeIcon },
  yml: { className: "text-purple-500", icon: FileCodeIcon },
};

export function FileTree({ paths }: { paths: string[] }) {
  const tree = buildFileTree(paths);

  if (tree.length === 0) {
    return <p className="p-5 text-muted-foreground text-sm">No file paths were recorded.</p>;
  }

  return (
    <div className="p-3">
      <Accordion
        className="space-y-1"
        defaultValue={tree.filter((node) => node.kind === "folder").map((node) => node.path)}
        type="multiple"
      >
        {tree.map((node) => (
          <TreeNodeItem key={node.path} node={node} />
        ))}
      </Accordion>
    </div>
  );
}

function TreeNodeItem({ depth = 0, node }: { depth?: number; node: FileNode }) {
  if (node.kind === "file") {
    const icon = iconForFile(node.name);

    return (
      <div
        className="flex min-h-8 items-center gap-2 rounded-md px-2 text-sm transition hover:bg-muted/50"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <HugeIcon className={cn("size-4 shrink-0", icon.className)} icon={icon.icon} />
        <span className="truncate font-mono text-muted-foreground text-xs">{node.name}</span>
      </div>
    );
  }

  return (
    <AccordionItem className="rounded-md border-b-0" value={node.path}>
      <AccordionTrigger
        className="min-h-8 rounded-md px-2 py-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <span className="flex min-w-0 items-center gap-2">
          <HugeIcon className="size-4 shrink-0 text-yellow-500" icon={FolderIcon} />
          <span className="truncate">{node.name}</span>
          <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {countFiles(node)}
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-1">
        <div className="space-y-1">
          {node.children.map((child) => (
            <TreeNodeItem depth={depth + 1} key={child.path} node={child} />
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function buildFileTree(paths: string[]): FileNode[] {
  const root = new Map<string, FileNode>();

  for (const path of paths) {
    const parts = path.split("/").filter(Boolean);
    let siblings = root;
    let currentPath = "";

    parts.forEach((part, index) => {
      currentPath = currentPath.length === 0 ? part : `${currentPath}/${part}`;
      const isFile = index === parts.length - 1;
      const existing = siblings.get(part);

      if (existing === undefined) {
        const node: FileNode = {
          children: [],
          kind: isFile ? "file" : "folder",
          name: part,
          path: currentPath,
        };
        siblings.set(part, node);
        if (!isFile) siblings = childrenMap(node);
        return;
      }

      if (!isFile) siblings = childrenMap(existing);
    });
  }

  return sortNodes([...root.values()]);
}

function childrenMap(node: FileNode): Map<string, FileNode> {
  const map = new Map(node.children.map((child) => [child.name, child]));
  const originalSet = map.set.bind(map);
  map.set = (key, value) => {
    if (!map.has(key)) node.children.push(value);
    return originalSet(key, value);
  };
  return map;
}

function sortNodes(nodes: FileNode[]): FileNode[] {
  return nodes
    .map((node) => ({
      ...node,
      children: sortNodes(node.children),
    }))
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

function countFiles(node: FileNode): number {
  if (node.kind === "file") return 1;
  return node.children.reduce((total, child) => total + countFiles(child), 0);
}

function iconForFile(name: string): FileIconConfig {
  if (name === "package.json" || name === "pnpm-lock.yaml") {
    return { className: "text-red-500", icon: NpmIcon };
  }

  const extension = name.split(".").at(-1)?.toLowerCase();
  const icon = extension === undefined ? undefined : fileTypeIcons[extension];
  if (icon !== undefined) return icon;

  if (name.startsWith(".")) return { className: "text-muted-foreground", icon: FileCodeIcon };

  return { className: "text-muted-foreground", icon: FileIcon };
}
