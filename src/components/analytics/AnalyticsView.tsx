import React from "react";
import { Panel } from "../ui/Panel";
import { Badge } from "../ui/Badge";
import { Eye, Heart, Users, Flame, TrendingUp } from "lucide-react";

export const AnalyticsView: React.FC = () => {
  return (
    <div className="p-8 flex-1 overflow-y-auto blueprint-grid space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-neutral-800">
        <div className="hud-label">// TELEMETRY_ANALYTICS</div>
        <h2 className="font-mono text-xl font-black text-white uppercase tracking-tight mt-1">
          MONITORING PERFORMA AKUN & KONTEN TIKTOK
        </h2>
        <p className="font-mono text-xs text-neutral-400 mt-1">
          Metrik langsung integrasi TikTok Content Posting & Analytics API.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Panel className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="hud-label">TOTAL_VIDEO_VIEWS</span>
            <Eye className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="font-mono text-3xl font-black text-white">482,500</div>
          <div className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-emerald-400">
            <TrendingUp className="w-3 h-3" />
            <span>+18.4% DARI MINGGU LALU</span>
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="hud-label">TOTAL_LIKES</span>
            <Heart className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="font-mono text-3xl font-black text-white">39,200</div>
          <div className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-emerald-400">
            <TrendingUp className="w-3 h-3" />
            <span>+12.1% ENGAGEMENT</span>
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="hud-label">TOTAL_FOLLOWERS</span>
            <Users className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="font-mono text-3xl font-black text-white">14,800</div>
          <div className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-emerald-400">
            <TrendingUp className="w-3 h-3" />
            <span>+620 FOLLOWER BARU</span>
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="hud-label">FYP_ALGORITHM_SCORE</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="font-mono text-3xl font-black text-amber-400">HIGH_94/100</div>
          <div className="mt-2 font-mono text-[10px] text-neutral-500">
            KONSISTENSI POSTING TINGGI
          </div>
        </Panel>
      </div>

      {/* Table Section */}
      <Panel className="p-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-800">
          <span className="hud-label">// PUBLISHED_FEED_BREAKDOWN</span>
          <Badge variant="neutral">TELEMETRY_LIVE</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-400">
                <th className="pb-3 hud-label">JUDUL KONTEN</th>
                <th className="pb-3 hud-label">TANGGAL TAYANG</th>
                <th className="pb-3 hud-label">VIEWS</th>
                <th className="pb-3 hud-label">LIKES</th>
                <th className="pb-3 hud-label">STATUS FYP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/80">
              <tr>
                <td className="py-3 font-sans font-bold text-white">5 Tools AI Gratis yang Jarang Diketahui</td>
                <td className="py-3 text-neutral-400">02.11.2026</td>
                <td className="py-3 text-white font-bold">142,800</td>
                <td className="py-3 text-neutral-300">18,400</td>
                <td className="py-3">
                  <Badge variant="rose">🔥 FYP_VIRAL</Badge>
                </td>
              </tr>
              <tr>
                <td className="py-3 font-sans font-bold text-white">Cara Atur Gaji UMR Biar Punya Tabungan</td>
                <td className="py-3 text-neutral-400">01.11.2026</td>
                <td className="py-3 text-white font-bold">89,200</td>
                <td className="py-3 text-neutral-300">9,150</td>
                <td className="py-3">
                  <Badge variant="emerald">OPTIMAL</Badge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
};

