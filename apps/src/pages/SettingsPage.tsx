import { useState, useEffect } from "react";
import { Cpu, User, MessageSquare, Terminal } from "lucide-react";
import { cn } from "../lib/utils";
import { API_BASE, apiFetch, directoryQuery } from "../lib/api";
import { ModelProviderSettings, Provider, isCliProvider } from "../components/settings/ModelProviderSettings";
import { SettingsCliConnectionsTab } from "../components/settings/SettingsCliConnectionsTab";
import { SettingsAccountTab } from "../components/settings/SettingsAccountTab";
import { SettingsMessagingTab } from "../components/settings/SettingsMessagingTab";
import { CornerCrosses } from "../components/ui/CornerCrosses";

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState("models");

  const tabs = [
    { id: "models", label: "MODEL PROVIDERS", icon: Cpu },
    { id: "cli", label: "CLI BRIDGES", icon: Terminal },
    { id: "messaging", label: "MESSAGING BOTS", icon: MessageSquare },
    { id: "account", label: "ACCOUNT & TELEMETRY", icon: User },
  ];
  const [providers, setProviders] = useState<Provider[]>([]);
  const [availableCatalogModels, setAvailableCatalogModels] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  const fetchProviders = async () => {
    try {
      let [providersRes, modelRes] = await Promise.all([
        apiFetch(`${API_BASE}/providers${directoryQuery()}`),
        apiFetch(`${API_BASE}/model${directoryQuery()}`),
      ]);

      if (!providersRes.ok && directoryQuery()) {
        const [fallbackP, fallbackM] = await Promise.all([
          apiFetch(`${API_BASE}/providers`),
          apiFetch(`${API_BASE}/model`),
        ]);
        if (fallbackP.ok) {
          providersRes = fallbackP;
          modelRes = fallbackM;
        }
      }

      const mJson = modelRes.ok ? await modelRes.json() : { data: [] };
      const rawModels: any[] = mJson.data || [];

      const catalogMap: Record<string, string[]> = {};
      for (const m of rawModels) {
        if (m.providerID) {
          catalogMap[m.providerID] = catalogMap[m.providerID] || [];
          catalogMap[m.providerID].push(m.id);
        }
      }
      setAvailableCatalogModels(catalogMap);

      if (providersRes.ok) {
        const pJson = await providersRes.json();
        const rawProviders: any[] = pJson.data || [];

        if (rawProviders.length > 0) {
          const savedActiveId = localStorage.getItem("arunaki_active_provider");
          const activeRawP = rawProviders.find((p: any) => p.id === savedActiveId);
          const isCliActive = savedActiveId
            ? (typeof activeRawP?.isCli === "boolean"
                ? activeRawP.isCli
                : isCliProvider({ id: savedActiveId, baseUrl: activeRawP?.baseUrl || "", name: activeRawP?.name || "", apiKey: activeRawP?.apiKey || "", type: activeRawP?.type || "", model: "", active: true, priority: 0 }))
            : false;

          const activeId = isCliActive
            ? null
            : (savedActiveId && rawProviders.some((p: any) => p.id === savedActiveId)
                ? savedActiveId
                : (rawProviders.find((p: any) => p.active)?.id || null));

          const mapped: Provider[] = rawProviders.map((p: any, idx: number) => {
            const savedSelected = localStorage.getItem("arunaki_provider_models_" + p.id);
            const associatedModels = rawModels.filter((m: any) => m.providerID === p.id);
            let modelNames = "";
            if (savedSelected && savedSelected.trim()) {
              modelNames = savedSelected.trim();
            } else if (p.model && p.model.trim()) {
              modelNames = p.model.trim();
            } else {
              const defaults = catalogMap[p.id] || associatedModels.map((m: any) => m.id);
              modelNames = defaults.slice(0, 3).join(", ") || "default";
            }

            return {
              id: p.id,
              name: p.name || p.id,
              type: p.type || "openai",
              model: modelNames,
              baseUrl: p.baseUrl || "",
              apiKey: p.apiKey || "",
              active: p.id === activeId,
              priority: p.priority ?? idx + 1,
              isCli: typeof p.isCli === "boolean"
                ? p.isCli
                : isCliProvider({ id: p.id, baseUrl: p.baseUrl || "", name: p.name || "", apiKey: p.apiKey || "", type: p.type || "", model: "", active: true, priority: 0 }),
            };
          });

          setProviders(mapped);
          return;
        }
      }

      setProviders([]);
    } catch (err) {
      console.error("Failed to fetch providers:", err);
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-neutral-950 bg-[radial-gradient(#1f1f1f_1px,transparent_1px)] [background-size:16px_16px] text-neutral-100 overflow-y-auto overflow-x-hidden select-none p-6 transition-none">
      <div className="max-w-5xl w-full mx-auto flex-1 flex flex-col min-h-0">
        {/* Header Title */}
        <div className="mb-6 border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-2 font-mono text-[11px] text-emerald-400 uppercase tracking-widest mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
            NEXUS SYSTEM SETTINGS | CONFIGURATION
          </div>
          <h1 className="text-xl font-mono font-extrabold tracking-tight text-white uppercase">
            SYSTEM TELEMETRY & PROVIDER ROUTING
          </h1>
          <p className="text-xs font-mono text-neutral-400 mt-1">
            Manage AI model providers, CLI bridge ports (20288), messaging webhooks, and local hardware execution.
          </p>
        </div>

        {/* Tab Navigation (Full width across container) */}
        <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-1 border-b border-neutral-800 pb-3 mb-6 shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-none text-[11px] font-mono tracking-wider transition-none cursor-pointer whitespace-nowrap h-9 select-none border text-center",
                  isActive
                    ? "bg-white text-black border-white font-bold"
                    : "bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-600"
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Settings Panel Content with CornerCrosses */}
        <div className="relative flex-1 w-full rounded-none p-6 overflow-y-auto min-h-0 bg-neutral-900/90 border border-neutral-800 shadow-2xl">
          <CornerCrosses className="text-neutral-500" size="sm" />

          <div className={cn("w-full", activeTab !== "models" && "hidden")}>
            <ModelProviderSettings
              providers={providers}
              availableCatalogModels={availableCatalogModels}
              loading={loading}
              onRefresh={fetchProviders}
              onUpdateProviders={setProviders}
            />
          </div>

          <div className={cn("w-full", activeTab !== "cli" && "hidden")}>
            <SettingsCliConnectionsTab
              providers={providers}
              onRefresh={fetchProviders}
            />
          </div>

          <div className={cn("w-full", activeTab !== "messaging" && "hidden")}>
            <SettingsMessagingTab />
          </div>

          <div className={cn("w-full", activeTab !== "account" && "hidden")}>
            <SettingsAccountTab />
          </div>
        </div>
      </div>
    </div>
  );
}
