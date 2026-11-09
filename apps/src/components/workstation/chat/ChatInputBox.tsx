import {
  useRef,
  useState,
  useMemo,
  useEffect,
  memo,
  type Dispatch,
  type SetStateAction,
  type KeyboardEvent,
} from "react";
import {
  Send,
  FileSearch,
  Eraser,
  Clock,
  Plus,
  Flame,
  Square,
  Paperclip,
  Minimize2,
  Sliders,
  Sparkles,
  Film,
  Volume2,
} from "lucide-react";
import { AetheriaLogo } from "../../common/AetheriaLogo";
import { toast } from "sonner";
import { useI18n } from "../../../lib/i18n";
import { useTheme } from "../../../lib/theme";
import { cn } from "../../../lib/utils";
import { API_BASE, apiFetch } from "../../../lib/api";
import {
  ChatAttachmentChips,
  ChatMentionsPopup,
  ChatSlashCommandsPopup,
  ChatModelPickerDropdown,
  ChatReasoningEffortDropdown,
  useChatInputClipboard,
  type SlashCommandItem,
  type AttachedFileItem,
} from "./input";
import { PresetStudioModal } from "./presets/PresetStudioModal";
import { AddSkillModal } from "./presets/AddSkillModal";

export type { AttachedFileItem };

interface ChatInputBoxProps {
  files?: { name: string }[];
  isStreaming: boolean;
  onSendMessage: (
    text: string,
    files?: Array<{ name: string; uri: string; mime?: string }>
  ) => void;
  onCancelStream?: () => void;
  onSearchSection?: () => void;
  onNewChat?: () => void;
  reasoningEffort?: string;
  setReasoningEffort?: (val: string) => void;
  /** Tier ids the active model actually offers. Empty means no picker and no variant on the request. */
  effortOptions?: string[];
  /** The model in use now, and the active provider's catalogue to switch between. */
  activeModel?: { providerID: string; id: string };
  modelOptions?: Array<{ id: string; name: string }>;
  onSelectModel?: (model: { id: string; name: string }) => void;
  showThinking?: boolean;
  setShowThinking?: Dispatch<SetStateAction<boolean>>;
  collapseThinking?: boolean;
  setCollapseThinking?: Dispatch<SetStateAction<boolean>>;
  onPreviewImage: (url: string) => void;
  onCompactSession?: () => void;
}

export const ChatInputBox = memo(function ChatInputBox({
  files = [],
  isStreaming,
  onSendMessage,
  onCancelStream,
  onSearchSection,
  onNewChat,
  reasoningEffort = "",
  setReasoningEffort,
  effortOptions = [] as string[],
  activeModel,
  modelOptions = [] as Array<{ id: string; name: string }>,
  onSelectModel,
  showThinking,
  setShowThinking,
  setCollapseThinking,
  onPreviewImage,
  onCompactSession,
}: ChatInputBoxProps) {
  const { t } = useI18n();
  const { isNeobrutalism } = useTheme();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localPrompt, setLocalPrompt] = useState("");

  // Clipboard, Screenshot, Drag/Drop & File Input Custom Hook
  const {
    attachedFiles,
    fileInputRef,
    handleAddImageDataUrl,
    handleFileInputChange,
    handlePaste,
    handleDragOver,
    handleDrop,
    handleRemoveFile,
    clearAttachedFiles,
  } = useChatInputClipboard({ textareaRef });

  // Mentions (@) popup
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);

  // Slash commands (/) popup
  const [showCommands, setShowCommands] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [showAddSkillModal, setShowAddSkillModal] = useState(false);
  const [registeredSkills, setRegisteredSkills] = useState<
    Array<{ id: string; name: string; command: string; description: string }>
  >([]);
  const [voicePresets, setVoicePresets] = useState<
    Array<{ id: string; name: string; command: string; description: string }>
  >([]);

  const loadRegisteredSkillsAndPresets = async () => {
    try {
      const res = await apiFetch(`${API_BASE}/skills`);
      const data = await res.json();
      if (data.success && Array.isArray(data.skills)) {
        setRegisteredSkills(data.skills);
      }
    } catch {
      // ignore
    }

    try {
      const res = await apiFetch(`${API_BASE}/studio/voice-presets`);
      const data = await res.json();
      if (data.success && data.presets?.aetheria?.styles) {
        const styles = data.presets.aetheria.styles;
        const mapped: Array<{ id: string; name: string; command: string; description: string }> = [];
        for (const [key, val] of Object.entries<any>(styles)) {
          const cmdName = key === "default" ? "/audio:pocketmyth" : `/audio:${key}`;
          mapped.push({
            id: key,
            name: val.label || key,
            command: cmdName,
            description: val.controlInstruction
              ? `${val.label || key}: ${val.controlInstruction}`
              : (val.label || "Preset gaya suara narator"),
          });
        }
        setVoicePresets(mapped);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadRegisteredSkillsAndPresets();
  }, []);

  // Reasoning effort dropdown & Model dropdown states
  const [isEffortDropdownOpen, setIsEffortDropdownOpen] = useState(false);
  const effortDropdownRef = useRef<HTMLDivElement>(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        effortDropdownRef.current &&
        !effortDropdownRef.current.contains(event.target as Node)
      ) {
        setIsEffortDropdownOpen(false);
      }
      if (
        modelDropdownRef.current &&
        !modelDropdownRef.current.contains(event.target as Node)
      ) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const mentionResults = useMemo(() => {
    if (!showMentions) return [];
    const q = mentionQuery.toLowerCase();
    return files
      .map((f) => f.name)
      .filter((name) => name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [showMentions, mentionQuery, files]);

  const availableCommands: SlashCommandItem[] = useMemo(() => {
    const base: SlashCommandItem[] = [
      {
        name: "/add skill",
        description: "Upload brief & register new motion graphics style to .aetheria/skills/",
        icon: Sparkles,
      },
      {
        name: "/add preset",
        description: "Add or tune Audio Voice Preset & Video Reference style in Studio",
        icon: Sliders,
      },
      {
        name: "/thinking",
        description: showThinking ? "Collapse thinking" : "Expand thinking",
        icon: AetheriaLogo,
      },
      {
        name: "/compact",
        description: "Smart compaction: summarize history & slash context tokens",
        icon: Minimize2,
      },
      {
        name: "/grill-me",
        description: "Interview requirements deeply before executing",
        icon: Flame,
      },
      { name: "/new", description: "Start a new conversation session", icon: Plus },
      {
        name: "/search-section",
        description: "Search topics across sessions",
        icon: FileSearch,
      },
      { name: "/clear", description: "Clear current conversation", icon: Eraser },
    ];

    // Dynamic registered motion skills loaded exclusively from .aetheria/skills/
    const skillCmds: SlashCommandItem[] = registeredSkills.map((s) => ({
      name: s.command.startsWith("/") ? s.command : `/${s.command}`,
      description: s.description || `Motion skill: ${s.name}`,
      icon: Film,
    }));

    // Dynamic Voicebox audio preset styles (/audio:pocketmyth, /audio:horror, /audio:crime_conspiracy, etc.)
    const audioCmds: SlashCommandItem[] = voicePresets.map((vp) => ({
      name: vp.command,
      description: vp.description,
      icon: Volume2,
    }));

    return [...base, ...skillCmds, ...audioCmds];
  }, [showThinking, registeredSkills, voicePresets]);

  const filteredCommands = useMemo(() => {
    if (!showCommands) return [];
    const q = commandQuery.toLowerCase().trim();
    if (!q) return availableCommands;

    // Direct category aliases
    if (q === "skill" || q === "skills" || q === "motion" || q === "style") {
      return availableCommands.filter(
        (cmd) =>
          cmd.name.startsWith("/add skill") ||
          cmd.icon === Film ||
          registeredSkills.some((s) => s.command.toLowerCase().includes(cmd.name.toLowerCase()))
      );
    }
    if (q === "audio" || q === "suara" || q === "voice" || q === "preset" || q === "sound") {
      return availableCommands.filter(
        (cmd) =>
          cmd.name.startsWith("/add preset") ||
          cmd.name.startsWith("/audio") ||
          cmd.icon === Volume2
      );
    }

    return availableCommands.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q) ||
        cmd.name.replace(/[\s:-]+/g, "-").toLowerCase().includes(q)
    );
  }, [showCommands, commandQuery, availableCommands, registeredSkills]);

  const handleInputChange = (val: string) => {
    setLocalPrompt(val);

    // Fast-path guard: only run regex if text contains '@'
    if (val.includes("@")) {
      const mentionMatch = val.match(/@(\w*)$/);
      if (mentionMatch) {
        setShowMentions(true);
        setMentionQuery(mentionMatch[1] || "");
        setMentionIndex(0);
        if (showCommands) setShowCommands(false);
        return;
      }
    }
    if (showMentions) {
      setShowMentions(false);
    }

    // Slash command trigger: matches '/' at the start or after a space
    if (val.includes("/")) {
      const commandMatch = val.match(/(?:^|\s)\/([\w:-]*)$/);
      if (commandMatch) {
        setShowCommands(true);
        setCommandQuery(commandMatch[1] || "");
        setSelectedCommandIndex(0);
        return;
      }
    }
    if (showCommands) {
      setShowCommands(false);
    }
  };

  const submitPrompt = () => {
    const promptTrimmed = localPrompt.trim();
    const promptLower = promptTrimmed.toLowerCase();
    if (
      promptLower === "/add" ||
      promptLower === "/add preset" ||
      promptLower === "/add-preset" ||
      promptLower === "/preset"
    ) {
      setLocalPrompt("");
      setShowCommands(false);
      setShowPresetModal(true);
      return;
    }

    if (promptTrimmed === "/thinking") {
      const current = showThinking !== undefined ? showThinking : true;
      const next = !current;
      try {
        localStorage.setItem("aetheria_show_thinking", String(next));
        localStorage.setItem("aetheria_reasoning_effort", next ? "high" : "");
      } catch { }
      setShowThinking?.(next);
      setCollapseThinking?.(!next);
      toast.info(next ? "Thinking expanded" : "Thinking collapsed");
      setLocalPrompt("");
      clearAttachedFiles();
      return;
    }

    if (promptTrimmed === "/compact") {
      setLocalPrompt("");
      clearAttachedFiles();
      onCompactSession?.();
      return;
    }

    if (promptTrimmed === "/clear" || promptTrimmed === "/new") {
      setLocalPrompt("");
      clearAttachedFiles();
      onNewChat?.();
      return;
    }

    if (!promptTrimmed && attachedFiles.length === 0) return;

    const filesToSend = attachedFiles.map((file) => ({
      name: file.name,
      uri: file.dataUrl,
      mime: file.mime,
    }));

    const finalPrompt =
      promptTrimmed ||
      (attachedFiles.some((f) => f.isImage)
        ? "Please review and analyze this attached image."
        : "Please review and analyze the attached file.");

    onSendMessage(finalPrompt, filesToSend.length > 0 ? filesToSend : undefined);
    setLocalPrompt("");
    clearAttachedFiles();
  };

  const insertMention = (filename: string) => {
    const updated = localPrompt.replace(/@\w*$/, `@${filename} `);
    setLocalPrompt(updated);
    setShowMentions(false);
    if (textareaRef.current) textareaRef.current.focus();
  };

  const handleCommandSelect = (cmdName: string) => {
    if (cmdName === "/add skill" || cmdName === "/add-skill") {
      setLocalPrompt("");
      setShowCommands(false);
      setShowAddSkillModal(true);
      return;
    }
    if (cmdName === "/add preset" || cmdName === "/add-preset" || cmdName === "/add") {
      setLocalPrompt("");
      setShowCommands(false);
      setShowPresetModal(true);
      return;
    }
    if (cmdName === "/thinking") {
      setLocalPrompt("");
      setShowCommands(false);
      const current = showThinking !== undefined ? showThinking : true;
      const next = !current;
      try {
        localStorage.setItem("aetheria_show_thinking", String(next));
        localStorage.setItem("aetheria_reasoning_effort", next ? "high" : "");
      } catch { }
      setShowThinking?.(next);
      setCollapseThinking?.(!next);
      toast.info(next ? "Thinking expanded" : "Thinking collapsed");
      return;
    }
    if (cmdName === "/compact") {
      setLocalPrompt("");
      setShowCommands(false);
      onCompactSession?.();
      return;
    }
    if (cmdName === "/search-section") {
      setLocalPrompt("");
      setShowCommands(false);
      onSearchSection?.();
      return;
    }
    if (cmdName === "/new" || cmdName === "/clear") {
      setLocalPrompt("");
      setShowCommands(false);
      onNewChat?.();
      return;
    }
    const hasTrailingSlash = /(?:^|\s)\/[\w:-]*$/.test(localPrompt);
    const updated = hasTrailingSlash
      ? localPrompt.replace(/(?:^|\s)\/[\w:-]*$/, (match) =>
          match.startsWith(" ") ? ` ${cmdName} ` : `${cmdName} `
        )
      : `${localPrompt.trim()} ${cmdName} `;
    setLocalPrompt(updated);
    setShowCommands(false);
    if (textareaRef.current) textareaRef.current.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && mentionResults.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % mentionResults.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + mentionResults.length) % mentionResults.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mentionResults[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        setShowMentions(false);
        return;
      }
    }

    if (showCommands && filteredCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedCommandIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedCommandIndex(
          (prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        handleCommandSelect(filteredCommands[selectedCommandIndex].name);
        return;
      }
      if (e.key === "Escape") {
        setShowCommands(false);
        return;
      }
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === "v" || e.key === "V")) {
      const desktop = typeof window !== "undefined" && (window as any).aetheriaDesktop;
      if (typeof desktop?.readClipboardImage === "function") {
        desktop
          .readClipboardImage()
          .then((dataUrl: string | null) => {
            if (dataUrl && typeof dataUrl === "string" && dataUrl.startsWith("data:image/")) {
              e.preventDefault();
              handleAddImageDataUrl(dataUrl, "screenshot");
            }
          })
          .catch(() => { });
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitPrompt();
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onPaste={handlePaste}
      className="relative bg-[var(--bg-card)] border border-[var(--border-color)] focus-within:border-[var(--border-strong)] rounded-2xl p-2.5 transition-[border-color] duration-150"
    >
      {/* File Mentions Popup */}
      <ChatMentionsPopup
        showMentions={showMentions}
        mentionResults={mentionResults}
        mentionIndex={mentionIndex}
        onSelectMention={insertMention}
      />

      {/* Slash Commands Popup */}
      <ChatSlashCommandsPopup
        showCommands={showCommands}
        filteredCommands={filteredCommands}
        selectedCommandIndex={selectedCommandIndex}
        onSelectCommand={handleCommandSelect}
      />

      {/* Preset & Reference Studio Modal (/add preset) */}
      <PresetStudioModal
        open={showPresetModal}
        onClose={() => setShowPresetModal(false)}
        onSendMessage={onSendMessage}
      />

      {/* Add Skill Modal (/add skill) */}
      <AddSkillModal
        open={showAddSkillModal}
        onClose={() => setShowAddSkillModal(false)}
        onSkillRegistered={(cmd) => {
          loadRegisteredSkillsAndPresets();
          setLocalPrompt(`${cmd} `);
          if (textareaRef.current) textareaRef.current.focus();
        }}
      />

      {/* Attached Files & Images Preview Chips */}
      <ChatAttachmentChips
        attachedFiles={attachedFiles}
        onRemoveFile={handleRemoveFile}
        onPreviewImage={onPreviewImage}
      />

      {/* Zero-JS Auto-Sizing Input Container: CSS Grid Ghost Mirror + Native field-sizing: content */}
      <div className="grid grid-cols-1 relative min-h-[24px] max-h-[160px]">
        {/* Invisible Ghost Sizer: sizes the grid row purely via browser layout engine with 0 JS */}
        <div
          aria-hidden="true"
          className="col-start-1 row-start-1 invisible whitespace-pre-wrap break-words text-xs leading-[20px] min-h-[24px] max-h-[160px] pointer-events-none select-none py-0.5 overflow-hidden"
        >
          {localPrompt ? localPrompt + "\n" : " "}
        </div>

        {/* Textarea with native Chromium field-sizing: content for 120 FPS C++ auto-expansion */}
        <textarea
          ref={textareaRef}
          value={localPrompt}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          placeholder={t(
            "askPlaceholder",
            "Describe a video scene, edit layers, or type @ for files, / for commands..."
          )}
          rows={1}
          style={{ fieldSizing: "content", maxHeight: "160px" } as React.CSSProperties}
          className="col-start-1 row-start-1 w-full min-h-[24px] max-h-[160px] bg-transparent text-xs leading-[20px] py-0.5 text-[var(--text-primary)] placeholder-[var(--text-dim)] resize-none overflow-y-auto focus:outline-none no-scrollbar"
        />
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-[var(--border-color)] mt-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Upload / Attach File Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "w-5 h-5 rounded-md flex items-center justify-center cursor-pointer transition-colors border",
              isNeobrutalism
                ? "neo-icon-badge bg-[#B388FF] text-[#141413] border-[#141413] hover:bg-[#CCFF00]"
                : "bg-[var(--bg-hover)] hover:bg-[var(--border-strong)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border-[var(--border-color)] hover:border-[var(--border-strong)]"
            )}
            title={t("attachFile", "Attach file or image")}
            aria-label="Attach file"
          >
            <Paperclip className="w-3 h-3" strokeWidth={1.75} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
            accept="*/*"
          />

          {/* Model Selection Dropdown */}
          <ChatModelPickerDropdown
            isOpen={isModelDropdownOpen}
            onToggle={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            dropdownRef={modelDropdownRef}
            activeModel={activeModel}
            modelOptions={modelOptions}
            onSelectModel={(m) => {
              onSelectModel?.(m);
              setIsModelDropdownOpen(false);
            }}
          />

          {/* Reasoning Effort Dropdown */}
          <ChatReasoningEffortDropdown
            isOpen={isEffortDropdownOpen}
            onToggle={() => setIsEffortDropdownOpen(!isEffortDropdownOpen)}
            dropdownRef={effortDropdownRef}
            reasoningEffort={reasoningEffort}
            effortOptions={effortOptions}
            setReasoningEffort={setReasoningEffort}
          />
        </div>

        <div className="flex items-center gap-1.5">
          {isStreaming ? (
            <>
              {(localPrompt.trim() || attachedFiles.length > 0) && (
                <button
                  type="button"
                  onClick={submitPrompt}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer bg-[var(--bg-hover)] hover:bg-[var(--bg-panel)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-color)]"
                  title={t("addToQueue", "Add to queue")}
                >
                  <Clock className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={onCancelStream}
                className="relative w-7 h-7 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 group"
                title={t("stopGenerating", "Stop generating")}
              >
                <span className="absolute -inset-[1.5px] rounded-full border-2 border-red-400 border-t-transparent animate-spin pointer-events-none" />
                <Square className="w-2.5 h-2.5 fill-white text-white transition-transform group-hover:scale-110" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={submitPrompt}
              disabled={!localPrompt.trim() && attachedFiles.length === 0}
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30",
                isNeobrutalism
                  ? "neo-icon-badge bg-[#FF9F43] hover:bg-[#CCFF00] text-[#141413] border border-[#141413]"
                  : "bg-[var(--text-primary)] hover:opacity-90 text-[var(--bg-app)]"
              )}
              title="Send message"
            >
              <Send className="w-3.5 h-3.5" strokeWidth={isNeobrutalism ? 2 : 1.5} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
