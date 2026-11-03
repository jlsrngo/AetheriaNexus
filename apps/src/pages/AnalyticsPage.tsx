import { memo } from "react";
import { TrendingUp, Eye, Heart, Users, ArrowUpRight } from "lucide-react";
import { CornerCrosses } from "../components/ui/CornerCrosses";

export const AnalyticsPage = memo(function AnalyticsPage() {
  return (
    <div className="flex-1 flex flex-col h-full w-full bg-neutral-950 text-neutral-100 overflow-y-auto select-none p-6">
      <div className="max-w-6xl w-full mx-auto flex-1 flex flex-col min-h-0 space-y-6">
        {/* Header */}
        <div className="border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-2 font-mono text-[10px] text-emerald-400 uppercase tracking-widest mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
            TIKTOK TELEMETRY // ENGAGEMENT METRICS
          </div>
          <h1 className="text-2xl font-mono font-extrabold uppercase tracking-tight text-white">
            ACCOUNT ANALYTICS & AUDIENCE INSIGHTS
          </h1>
          <p className="text-xs font-mono text-neutral-400 mt-1">
            Track video watch time retention curves, views velocity, and follower conversion rate.
          </p>
        </div>

        {/* 4 Telemetry Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative bg-neutral-900/90 border border-neutral-800 p-4 font-mono">
            <CornerCrosses size="sm" className="text-neutral-700" />
            <div className="flex items-center justify-between text-neutral-400 text-xs">
              <span className="text-[10px] uppercase tracking-widest text-neutral-500">Total Views (30D)</span>
              <Eye className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white mt-2">248,920</div>
            <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              +24.5% vs previous cycle
            </div>
          </div>

          <div className="relative bg-neutral-900/90 border border-neutral-800 p-4 font-mono">
            <CornerCrosses size="sm" className="text-neutral-700" />
            <div className="flex items-center justify-between text-neutral-400 text-xs">
              <span className="text-[10px] uppercase tracking-widest text-neutral-500">Likes & Saves</span>
              <Heart className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-black text-white mt-2">18,430</div>
            <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              +18.2% engagement rate
            </div>
          </div>

          <div className="relative bg-neutral-900/90 border border-neutral-800 p-4 font-mono">
            <CornerCrosses size="sm" className="text-neutral-700" />
            <div className="flex items-center justify-between text-neutral-400 text-xs">
              <span className="text-[10px] uppercase tracking-widest text-neutral-500">Followers Growth</span>
              <Users className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-black text-white mt-2">+3,820</div>
            <div className="text-[10px] text-neutral-400 mt-1">Total Audience: 28.4K</div>
          </div>

          <div className="relative bg-neutral-900/90 border border-neutral-800 p-4 font-mono">
            <CornerCrosses size="sm" className="text-neutral-700" />
            <div className="flex items-center justify-between text-neutral-400 text-xs">
              <span className="text-[10px] uppercase tracking-widest text-neutral-500">Avg Retention</span>
              <TrendingUp className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-400 mt-2">78.4%</div>
            <div className="text-[10px] text-neutral-400 mt-1">High retention benchmark</div>
          </div>
        </div>

        {/* Video Performance Breakdown */}
        <div className="relative bg-neutral-900/90 border border-neutral-800 p-5 font-mono">
          <CornerCrosses size="sm" className="text-neutral-700" />
          <h2 className="text-sm font-bold uppercase text-white tracking-wider mb-3">
            TOP PERFORMING TIKTOK VIDEOS
          </h2>

          <div className="space-y-2">
            {[
              { title: "3 Morning Habits of Peak Performers", views: "142.8K", likes: "12.4K", retention: "84.2%" },
              { title: "The 2-Minute Dopamine Reset Rule", views: "78.2K", likes: "6.8K", retention: "76.1%" },
              { title: "Why 99% Fail At Compound Interest", views: "27.9K", likes: "1.9K", retention: "69.4%" },
            ].map((v, idx) => (
              <div
                key={v.title}
                className="flex items-center justify-between p-3 bg-neutral-950 border border-neutral-800 hover:border-neutral-700"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-neutral-500 font-bold">#0{idx + 1}</span>
                  <span className="text-xs text-white font-bold">{v.title}</span>
                </div>
                <div className="flex items-center gap-6 text-xs">
                  <span className="text-neutral-400">{v.views} VIEWS</span>
                  <span className="text-neutral-400">{v.likes} LIKES</span>
                  <span className="text-emerald-400 font-bold">{v.retention} RETENTION</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

