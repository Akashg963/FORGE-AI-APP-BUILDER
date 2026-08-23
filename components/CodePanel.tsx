// components/CodePanel.tsx
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/exhaustive-deps */

"use client";

import { useEffect, useRef, useState } from "react";

import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
  SandpackFileExplorer,
  useSandpack,
} from "@codesandbox/sandpack-react";

import { dracula } from "@codesandbox/sandpack-themes";

import {
  Eye,
  Code2,
  Download,
  AlertTriangle,
  Bot,
  Loader2,
  ArrowUp,
} from "lucide-react";

import { RingLoader } from "react-spinners";
import JSZip from "jszip";

import { Button } from "@/components/ui/button";
import { PricingModal } from "@/components/PricingModal";

import type { FileData, StatusStep } from "@/types/workspace";

// ============================================================================
// PLACEHOLDER
// ============================================================================

const PLACEHOLDER_FILES = {
  "/App.js": {
    code: `export default function App() {
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "#0a0a0a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        color: "white",
      }}
    >
      <div style={{ textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚡</div>

        <p style={{ fontSize: 14 }}>
          Your app will appear here
        </p>
      </div>
    </div>
  );
}`,
  },
};

// ============================================================================
// BASE DEPENDENCIES
// ============================================================================

const BASE_DEPENDENCIES: Record<string, string> = {
  "react-is": "latest",
  "react-router-dom": "latest",
  "lucide-react": "latest",
  recharts: "latest",
  "date-fns": "latest",
  "framer-motion": "latest",
  "react-hook-form": "latest",
  "@hookform/resolvers": "latest",
  zod: "latest",
  "@radix-ui/react-dialog": "latest",
  "@radix-ui/react-dropdown-menu": "latest",
  "@radix-ui/react-tabs": "latest",
  "@radix-ui/react-tooltip": "latest",
  "@radix-ui/react-accordion": "latest",
  "@radix-ui/react-select": "latest",
  axios: "latest",
  clsx: "latest",
  "class-variance-authority": "latest",
  "tailwind-merge": "latest",
};

// ============================================================================
// TYPES
// ============================================================================

type ActiveTab = "preview" | "code";

interface CodePanelProps {
  fileData: FileData | null;
  isGenerating: boolean;
  statusLog: StatusStep[];
  onImprove: (userRequest: string) => Promise<void>;
  onFixError: (error: string) => Promise<void>;
  onFilePatch: (patches: FileData) => void;
  appTitle: string | null;
  isImproving: boolean;
  isProUser: boolean;
}

// ============================================================================
// SANDPACK INNER
// ============================================================================

function SandpackInner({
  isGenerating,
  statusLog,
  activeTab,
  setActiveTab,
  onImprove,
  onFixError,
  fileData,
  appTitle,
  isImproving,
  isProUser,
}: {
  isGenerating: boolean;
  statusLog: StatusStep[];
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onImprove: (userRequest: string) => Promise<void>;
  onFixError: (error: string) => Promise<void>;
  fileData: FileData | null;
  appTitle: string | null;
  isImproving: boolean;
  isProUser: boolean;
}) {
  const { sandpack, listen } = useSandpack();

  // --------------------------------------------------------------------------
  // Local state
  // --------------------------------------------------------------------------

  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [improveInput, setImproveInput] = useState("");
  const [showImproveInput, setShowImproveInput] = useState(false);

  // --------------------------------------------------------------------------
  // Refs
  // --------------------------------------------------------------------------

  const unsubscribeRef = useRef<(() => void) | null>(null);

  const previousFilesRef = useRef<
    Record<string, { code: string }>
  >({});

  // ==========================================================================
  // UPDATE SANDPACK FILES
  //
  // IMPORTANT:
  // Dependency array has ONE fixed entry: [fileData]
  //
  // This avoids:
  //
  // "The final argument passed to useEffect changed size between renders"
  // ==========================================================================

  useEffect(() => {
    const currentFiles = fileData?.files;

    if (!currentFiles) {
      return;
    }

    const previousFiles = previousFilesRef.current;

    Object.entries(currentFiles).forEach(([path, file]) => {
      const previousCode = previousFiles[path]?.code;

      if (previousCode !== file.code) {
        try {
          sandpack.updateFile(path, file.code);
        } catch (error) {
          console.error(
            `Failed to update Sandpack file: ${path}`,
            error
          );
        }
      }
    });

    previousFilesRef.current = currentFiles;
  }, [fileData]);

  // ==========================================================================
  // SANDPACK RUNTIME ERROR LISTENER
  //
  // Fixed dependency array: [listen]
  // ==========================================================================

  useEffect(() => {
    const unsubscribe = listen((message) => {
      try {
        if (
          message.type === "action" &&
          "action" in message &&
          message.action === "show-error"
        ) {
          const errorMessage =
            "message" in message &&
            typeof message.message === "string"
              ? message.message
              : "An error occurred in the preview.";

          setPreviewError(errorMessage);
          return;
        }

        if (message.type === "compile") {
          const errorMessage =
            "message" in message &&
            typeof message.message === "string"
              ? message.message
              : "Compile error in preview.";

          setPreviewError(errorMessage);
          return;
        }

        if (message.type === "success") {
          setPreviewError(null);
        }
      } catch (error) {
        console.error("Sandpack listener error:", error);
      }
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      unsubscribe?.();
      unsubscribeRef.current = null;
    };
  }, [listen]);

  // ==========================================================================
  // CLEAR PREVIEW ERRORS
  //
  // Fixed dependency array: [isGenerating, isImproving]
  // ==========================================================================

  useEffect(() => {
    if (isGenerating || isImproving) {
      setPreviewError(null);
    }
  }, [isGenerating, isImproving]);

  // ==========================================================================
  // IMPROVE SUBMIT
  // ==========================================================================

  const handleImproveSubmit = async () => {
    const trimmed = improveInput.trim();

    if (!trimmed || isImproving) {
      return;
    }

    setImproveInput("");
    setShowImproveInput(false);

    try {
      await onImprove(trimmed);
    } catch (error) {
      console.error("Improve request failed:", error);
    }
  };

  // ==========================================================================
  // EXPORT PROJECT
  // ==========================================================================

  const handleExportZip = async () => {
    if (isExporting) {
      return;
    }

    setIsExporting(true);

    try {
      const filesToZip =
        Object.keys(sandpack.files).length > 0
          ? sandpack.files
          : fileData?.files ?? {};

      const dependencies = {
        ...BASE_DEPENDENCIES,
        ...(fileData?.dependencies ?? {}),
      };

      const zip = new JSZip();

      // ----------------------------------------------------------------------
      // package.json
      // ----------------------------------------------------------------------

      const packageJson = {
        name: "forge-app",
        version: "1.0.0",
        private: true,

        dependencies: {
          react: "^18.2.0",
          "react-dom": "^18.2.0",
          "react-scripts": "5.0.1",
          ...dependencies,
        },

        scripts: {
          start: "react-scripts start",
          build: "react-scripts build",
        },

        browserslist: {
          production: [
            ">0.2%",
            "not dead",
            "not op_mini all",
          ],

          development: [
            "last 1 chrome version",
          ],
        },
      };

      zip.file(
        "package.json",
        JSON.stringify(packageJson, null, 2)
      );

      // ----------------------------------------------------------------------
      // public/index.html
      // ----------------------------------------------------------------------

      zip.file(
        "public/index.html",
        `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1"
    />
    <title>Forge App</title>

    <script src="https://cdn.tailwindcss.com"></script>
  </head>

  <body>
    <div id="root"></div>
  </body>
</html>`
      );

      // ----------------------------------------------------------------------
      // Project files
      // ----------------------------------------------------------------------

      for (const [filePath, fileObj] of Object.entries(
        filesToZip
      )) {
        const code =
          typeof fileObj === "object" &&
          fileObj !== null &&
          "code" in fileObj
            ? (fileObj as { code: string }).code
            : "";

        const normalizedPath = filePath.startsWith("/")
          ? filePath.slice(1)
          : filePath;

        const zipPath = normalizedPath.startsWith("src/")
          ? normalizedPath
          : `src/${normalizedPath}`;

        zip.file(zipPath, code);
      }

      // ----------------------------------------------------------------------
      // src/index.js
      // ----------------------------------------------------------------------

      zip.file(
        "src/index.js",
        `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`
      );

      // ----------------------------------------------------------------------
      // README
      // ----------------------------------------------------------------------

      zip.file(
        "README.md",
        `# Forge App

Generated with Forge.

## Getting Started

\`\`\`bash
npm install
npm start
\`\`\`
`
      );

      // ----------------------------------------------------------------------
      // Download
      // ----------------------------------------------------------------------

      const blob = await zip.generateAsync({
        type: "blob",
      });

      const url = URL.createObjectURL(blob);

      const anchor = document.createElement("a");

      anchor.href = url;

      const zipName = appTitle
        ? `${appTitle
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")}.zip`
        : "forge-app.zip";

      anchor.download = zipName;

      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  // ==========================================================================
  // CURRENT STATUS
  // ==========================================================================

  const currentStepLabel =
    statusLog.length > 0
      ? statusLog[statusLog.length - 1]?.label
      : "Generating…";

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div
      className="flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden"
      style={{
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
      }}
    >
      {/* ================================================================== */}
      {/* TABS + ACTIONS                                                     */}
      {/* ================================================================== */}

      <div
        className="flex w-full shrink-0 items-center justify-between border-b border-white/6 px-2"
        style={{
          width: "100%",
          minWidth: 0,
          height: "48px",
        }}
      >
        {/* ---------------------------------------------------------------- */}
        {/* Tabs                                                             */}
        {/* ---------------------------------------------------------------- */}

        <div className="flex h-full items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("code")}
            className={`flex h-full items-center gap-2 px-4 text-sm font-medium transition-all ${
              activeTab === "code"
                ? "border-b-2 border-blue-400 text-white"
                : "border-b-2 border-transparent text-white/50 hover:text-white"
            }`}
          >
            <Code2 className="h-4 w-4" />
            Code
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            className={`flex h-full items-center gap-2 px-4 text-sm font-medium transition-all ${
              activeTab === "preview"
                ? "border-b-2 border-blue-400 text-white"
                : "border-b-2 border-transparent text-white/50 hover:text-white"
            }`}
          >
            <Eye className="h-4 w-4" />
            Preview
          </button>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Actions                                                          */}
        {/* ---------------------------------------------------------------- */}

        <div className="flex items-center gap-1.5">
          {/* Improve button */}

          {isProUser ? (
            showImproveInput ? (
              <div className="flex items-center gap-1.5">
                <div className="relative flex items-center">
                  <Bot className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-violet-400" />

                  <input
                    autoFocus
                    value={improveInput}
                    onChange={(event) =>
                      setImproveInput(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void handleImproveSubmit();
                      }

                      if (event.key === "Escape") {
                        setShowImproveInput(false);
                      }
                    }}
                    placeholder="What should I improve?"
                    className="h-7 w-56 rounded-md border border-violet-500/30 bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-cyan-500/10 pl-8 pr-3 text-xs text-white/80 placeholder:text-white/30 focus:border-violet-400/50 focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void handleImproveSubmit()}
                  disabled={
                    !improveInput.trim() || isImproving
                  }
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-violet-500/30 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-violet-300 transition-all hover:border-violet-400/50 hover:from-violet-500/30 hover:to-fuchsia-500/30 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isImproving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <ArrowUp className="h-3 w-3" />
                  )}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowImproveInput(true)}
                disabled={isImproving || !fileData}
                className="group relative flex h-7 cursor-pointer items-center gap-1.5 overflow-hidden rounded-md border border-white/10 bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-cyan-500/10 px-2.5 text-xs font-medium transition-all hover:border-white/20 hover:from-violet-500/20 hover:via-fuchsia-500/20 hover:to-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                {isImproving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
                ) : (
                  <Bot className="h-3.5 w-3.5 text-violet-400" />
                )}

                <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
                  {isImproving
                    ? "Improving…"
                    : "Improve with Agent"}
                </span>

                {!isImproving && (
                  <span className="rounded-sm bg-violet-500/30 px-1 py-0.5 text-[10px] font-semibold leading-none text-violet-300">
                    PRO
                  </span>
                )}
              </button>
            )
          ) : (
            <PricingModal reason="upgrade">
              <span className="group relative flex h-7 cursor-pointer items-center gap-1.5 overflow-hidden rounded-md border border-white/10 bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-cyan-500/10 px-2.5 text-xs font-medium text-white/60 transition-all hover:border-white/20 hover:text-white/90">
                <span className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                <Bot className="h-3.5 w-3.5 text-violet-400" />

                <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
                  Improve with Agent
                </span>

                <span className="rounded-sm bg-violet-500/30 px-1 py-0.5 text-[10px] font-semibold leading-none text-violet-300">
                  PRO
                </span>
              </span>
            </PricingModal>
          )}

          {/* Download */}

          <Button
            variant="ghost"
            onClick={() => void handleExportZip()}
            disabled={isExporting || !fileData}
          >
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}

            Download
          </Button>
        </div>
      </div>

      {/* ================================================================== */}
      {/* CONTENT AREA                                                       */}
      {/* ================================================================== */}

      <div
        className="relative flex-1 min-h-0 min-w-0 overflow-hidden"
        style={{
          width: "100%",
          height: "calc(100% - 48px)",
          minWidth: 0,
          minHeight: 0,
        }}
      >
        {/* ---------------------------------------------------------------- */}
        {/* Generation / improvement overlay                                */}
        {/* ---------------------------------------------------------------- */}

        {(isGenerating || isImproving) && (
          <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-[#0a0a0a]/85 backdrop-blur-sm">
            <RingLoader
              color="#60a5fa"
              size={64}
              speedMultiplier={0.8}
            />

            <div className="flex flex-col items-center gap-1.5">
              <p className="text-sm font-medium text-white/60">
                {isImproving
                  ? "Improving with Cline AI…"
                  : currentStepLabel}
              </p>

              <p className="text-xs text-white/20">
                This usually takes 10–20 seconds
              </p>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* SANDPACK                                                          */}
        {/* ================================================================== */}

        <SandpackLayout
  className="sandpack-workspace-layout"
  style={{
    // your existing styles...
  }}
>
  <>
    {/* ============================================================ */}
    {/* PREVIEW                                                      */}
    {/* ============================================================ */}

    <div
      className="sandpack-preview-wrapper"
      style={{
        display: activeTab === "preview" ? "flex" : "none",

        flex: "1 1 100%",

        width: "100%",
        height: "100%",

        minWidth: 0,
        minHeight: 0,

        maxWidth: "none",
        maxHeight: "none",

        overflow: "hidden",

        margin: 0,
        padding: 0,
      }}
    >
      <SandpackPreview
        showOpenInCodeSandbox={false}
        style={{
          display: "flex",
          flex: "1 1 auto",

          width: "100%",
          height: "100%",

          minWidth: 0,
          minHeight: 0,

          maxWidth: "none",
          maxHeight: "none",

          margin: 0,
          padding: 0,

          overflow: "hidden",

          background: "#ffffff",
        }}
      />
    </div>

    {/* ============================================================ */}
    {/* CODE                                                         */}
    {/* ============================================================ */}

    <div
      className="sandpack-code-wrapper"
      style={{
        display: activeTab === "code" ? "flex" : "none",

        flexDirection: "row",

        flex: "1 1 100%",

        width: "100%",
        height: "100%",

        minWidth: 0,
        minHeight: 0,

        maxWidth: "none",
        maxHeight: "none",

        overflow: "hidden",

        margin: 0,
        padding: 0,
      }}
    >
      {/* Your existing File Explorer */}
      <div
        style={{
          display: "flex",
          flex: "0 0 180px",
          width: "180px",
          minWidth: "180px",
          maxWidth: "180px",
          height: "100%",
          minHeight: 0,
          overflow: "hidden",
          borderRight: "0.5px solid rgba(255,255,255,0.08)",
        }}
      >
        <SandpackFileExplorer
          style={{
            width: "100%",
            height: "100%",
            minWidth: 0,
            minHeight: 0,
            maxWidth: "none",
            overflow: "auto",
          }}
        />
      </div>

      {/* Your existing Code Editor */}
      <div
        style={{
          display: "flex",
          flex: "1 1 auto",
          width: "calc(100% - 180px)",
          minWidth: 0,
          minHeight: 0,
          height: "100%",
          overflow: "hidden",
        }}
      >
        <SandpackCodeEditor
          style={{
            display: "flex",
            flex: "1 1 auto",
            width: "100%",
            height: "100%",
            minWidth: 0,
            minHeight: 0,
            maxWidth: "none",
            maxHeight: "none",
            overflow: "auto",
          }}
          showTabs
          showLineNumbers
          showInlineErrors
          closableTabs
          readOnly
        />
      </div>
    </div>
  </>
</SandpackLayout>

        {/* ================================================================== */}
        {/* SANDPACK SIZE OVERRIDES                                            */}
        {/* ================================================================== */}

        <style jsx global>{`
          /*
           * Force Sandpack's own generated layout classes to use the
           * complete available workspace.
           */

          .sandpack-workspace-layout {
            width: 100% !important;
            height: 100% !important;

            min-width: 0 !important;
            min-height: 0 !important;

            max-width: none !important;
            max-height: none !important;

            margin: 0 !important;
            padding: 0 !important;

            overflow: hidden !important;
          }

          .sandpack-workspace-layout.sp-layout {
            width: 100% !important;
            height: 100% !important;

            min-width: 0 !important;
            min-height: 0 !important;

            max-width: none !important;
            max-height: none !important;

            display: flex !important;
            flex-direction: row !important;
            flex-wrap: nowrap !important;
          }

          /*
           * Preview
           */

          .sandpack-workspace-layout
            .sandpack-preview-wrapper {
            width: 100% !important;
            height: 100% !important;

            min-width: 0 !important;
            min-height: 0 !important;

            max-width: none !important;
            max-height: none !important;

            flex: 1 1 100% !important;

            overflow: hidden !important;
          }

          .sandpack-workspace-layout
            .sp-preview {
            width: 100% !important;
            height: 100% !important;

            min-width: 0 !important;
            min-height: 0 !important;

            max-width: none !important;
            max-height: none !important;

            flex: 1 1 auto !important;
          }

          .sandpack-workspace-layout
            .sp-preview-container {
            width: 100% !important;
            height: 100% !important;

            min-width: 0 !important;
            min-height: 0 !important;

            max-width: none !important;
            max-height: none !important;

            flex: 1 1 auto !important;

            overflow: hidden !important;
          }

          .sandpack-workspace-layout
            iframe.sp-preview-iframe {
            display: block !important;

            width: 100% !important;
            height: 100% !important;

            min-width: 0 !important;
            min-height: 0 !important;

            max-width: none !important;
            max-height: none !important;

            border: 0 !important;
          }

          /*
           * Code mode
           */

          .sandpack-workspace-layout
            .sandpack-code-wrapper {
            width: 100% !important;
            height: 100% !important;

            min-width: 0 !important;
            min-height: 0 !important;

            flex: 1 1 100% !important;

            overflow: hidden !important;
          }

          .sandpack-workspace-layout
            .sp-file-explorer {
            min-width: 0 !important;
            height: 100% !important;
          }

          .sandpack-workspace-layout
            .sp-code-editor {
            width: 100% !important;
            height: 100% !important;

            min-width: 0 !important;
            min-height: 0 !important;

            max-width: none !important;
            max-height: none !important;

            flex: 1 1 auto !important;
          }

          .sandpack-workspace-layout
            .sp-stack {
            min-width: 0 !important;
            min-height: 0 !important;
          }
        `}</style>
      </div>

      {/* ================================================================== */}
      {/* PREVIEW ERROR                                                      */}
      {/* ================================================================== */}

      {previewError &&
        !isGenerating &&
        !isImproving &&
        activeTab === "preview" && (
          <div className="absolute inset-x-0 bottom-0 z-[110] border-t border-red-500/20 bg-red-950/95 p-4">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400/70" />

              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-red-400/80">
                  Preview error
                </p>

                <p className="break-all text-[11px] text-red-300/50">
                  {previewError}
                </p>
              </div>

              <Button
                onClick={() =>
                  void onFixError(previewError)
                }
                variant="destructive"
              >
                <Bot className="h-3 w-3" />
                Fix with AI
              </Button>
            </div>
          </div>
        )}
    </div>
  );
}

// ============================================================================
// CODE PANEL
// ============================================================================

export function CodePanel({
  fileData,
  isGenerating,
  statusLog,
  onImprove,
  onFixError,
  onFilePatch: _onFilePatch,
  appTitle,
  isImproving,
  isProUser,
}: CodePanelProps) {
  // --------------------------------------------------------------------------
  // Active tab
  // --------------------------------------------------------------------------

  const [activeTab, setActiveTab] =
    useState<ActiveTab>("preview");

  // --------------------------------------------------------------------------
  // Automatically open Preview after a new project is generated.
  //
  // IMPORTANT:
  // Dependency array has ONE fixed entry.
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (fileData) {
      setActiveTab("preview");
    }
  }, [fileData]);

  // --------------------------------------------------------------------------
  // Files
  // --------------------------------------------------------------------------

  const files =
    fileData?.files ?? PLACEHOLDER_FILES;

  // --------------------------------------------------------------------------
  // Dependencies
  // --------------------------------------------------------------------------

  const dependencies = {
    ...BASE_DEPENDENCIES,
    ...(fileData?.dependencies ?? {}),
  };

  // --------------------------------------------------------------------------
  // IMPORTANT:
  //
  // Provider is remounted ONLY when the file PATHS change.
  //
  // It is NOT remounted when file contents change.
  // --------------------------------------------------------------------------

  const filePathKey = Object.keys(files)
    .sort()
    .join("|");

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div
      className="flex h-full w-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      style={{
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
      }}
    >
      <SandpackProvider
        key={filePathKey}
        template="react"
        theme={dracula}
        files={files}
        customSetup={{
          dependencies,
        }}
        options={{
          externalResources: [
            "https://cdn.tailwindcss.com",
          ],

          recompileMode: "delayed",
          recompileDelay: 500,
        }}
        style={{
          width: "100%",
          height: "100%",
          minWidth: 0,
          minHeight: 0,
        }}
      >
        <SandpackInner
          isGenerating={isGenerating}
          statusLog={statusLog}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onImprove={onImprove}
          onFixError={onFixError}
          fileData={fileData}
          appTitle={appTitle}
          isImproving={isImproving}
          isProUser={isProUser}
        />
      </SandpackProvider>
    </div>
  );
}