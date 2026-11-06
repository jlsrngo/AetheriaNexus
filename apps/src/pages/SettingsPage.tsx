import { useState, useEffect } from "react";
import { Cpu, User, MessageSquare, Terminal } from "lucide-react";
import { cn } from "../lib/utils";
import { API_BASE, apiFetch, directoryQuery } from "../lib/api";
import { ModelProviderSettings, Provider, isCliProvider } from "../components/settings/ModelProviderSettings";
import { SettingsCliConnectionsTab } from "../components/settings/SettingsCliConnectionsTab";
import { SettingsAccountTab } from "../components/settings/SettingsAccountTab";
import { SettingsMessagingTab } from "../components/settings/SettingsMessagingTab";

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState("models");

  const tabs = [
    { id: "models", label: "Model Providers", icon: Cpu },
    { id: "cli", label: "CLI Bridges", icon: Terminal },
    { id: "messaging", label: "Messaging Bots", icon: MessageSquare },
    { id: "account", label: "Account & Telemetry", icon: User },
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
    <div className="flex-1 flex flex-col h-full w-full bg-[var(--bg-app)] text-[var(--text-primary)] overflow-y-auto select-none p-4 sm:p-6">
      <div className="max-w-4xl w-full mx-auto flex-1 flex flex-col min-h-0 space-y-4">
        {/* Header Title */}
        <div className="border-b border-[var(--border-color)] pb-3">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--text-primary)]">
            System Telemetry & Provider Routing
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Manage AI model providers, CLI bridge ports (20288), messaging webhooks, and local hardware execution.
          </p>
        </div>

        {/* Tab Navigation Capsule */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shrink-0 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap h-8 select-none",
                  isActive
                    ? "bg-[#cf6613] text-white shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)]"
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Settings Panel Content */}
        <div className="relative flex-1 w-full rounded-2xl p-5 sm:p-6 overflow-y-auto min-h-0 bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl">
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
