import React from "react";
import { Panel } from "../ui/Panel";
import { Badge } from "../ui/Badge";
import { Eye, Heart, Users, Flame, TrendingUp } from "lucide-react";
import { TikTokAccountMetrics, TikTokVideoMetric } from "../../types";

interface AnalyticsViewProps {
  metrics: TikTokAccountMetrics;
  feed: TikTokVideoMetric[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ metrics, feed }) => {
  return (
    <div className="p-8 flex-1 overflow-y-auto blueprint-grid space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-neutral-800 flex items-center justify-between">
        <div>
          <div className="hud-label">// RUST_NATIVE_TELEMETRY</div>
          <h2 className="font-mono text-xl font-black text-white uppercase tracking-tight mt-1">
            MONITORING PERFORMA AKUN & KONTEN TIKTOK
          </h2>
          <p className="font-mono text-xs text-neutral-400 mt-1">
            Metrik langsung dievaluasi via backend native Rust tanpa membebani browser.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="emerald">{metrics.auth_status}</Badge>
          <span className="font-mono text-xs text-white font-bold">{metrics.connected_account}</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Panel className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="hud-label">TOTAL_VIDEO_VIEWS</span>
            <Eye className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="font-mono text-3xl font-black text-white">
            {metrics.total_views.toLocaleString()}
          </div>
          <div className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-emerald-400">
            <TrendingUp className="w-3 h-3" />
            <span>+{metrics.weekly_growth_percent}% MINGGU INI</span>
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="hud-label">TOTAL_LIKES</span>
            <Heart className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="font-mono text-3xl font-black text-white">
            {metrics.total_likes.toLocaleString()}
          </div>
          <div className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-emerald-400">
            <TrendingUp className="w-3 h-3" />
            <span>OPTIMAL_ENGAGEMENT</span>
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="hud-label">TOTAL_FOLLOWERS</span>
            <Users className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="font-mono text-3xl font-black text-white">
            {metrics.followers.toLocaleString()}
          </div>
          <div className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-emerald-400">
            <TrendingUp className="w-3 h-3" />
            <span>PERTUMBUHAN_STABIL</span>
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="hud-label">FYP_ALGORITHM_SCORE</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="font-mono text-3xl font-black text-amber-400">
            {metrics.fyp_score}
          </div>
          <div className="mt-2 font-mono text-[10px] text-neutral-500">
            KONSISTENSI_HIGH_SCORE
          </div>
        </Panel>
      </div>

      {/* Table Section */}
      <Panel className="p-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-800">
          <span className="hud-label">// PUBLISHED_FEED_BREAKDOWN</span>
          <Badge variant="neutral">STREAM_SYNCHRONIZED</Badge>
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
              {feed.map((v) => (
                <tr key={v.id}>
                  <td className="py-3 font-sans font-bold text-white">{v.title}</td>
                  <td className="py-3 text-neutral-400">{v.published_date}</td>
                  <td className="py-3 text-white font-bold">{v.views.toLocaleString()}</td>
                  <td className="py-3 text-neutral-300">{v.likes.toLocaleString()}</td>
                  <td className="py-3">
                    <Badge variant={v.fyp_status.includes("VIRAL") ? "rose" : "emerald"}>
                      {v.fyp_status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
};
