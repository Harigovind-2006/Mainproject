"use client";

import { useState } from "react";

export default function Dashboard() {
  const [aiActive, setAiActive] = useState(true);

  return (
    <main className="min-h-screen bg-[#070b14] text-white">

      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-64
                         bg-[#0b111d] border-r border-white/10
                         p-6">

        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-blue-600
                          flex items-center justify-center">
            <span className="font-bold text-lg">A</span>
          </div>

          <div>
            <h1 className="font-bold text-lg">
              AutoDrive
            </h1>

            <p className="text-xs text-gray-500">
              AI Control System
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-2">

          <NavItem
            name="Dashboard"
            active
            icon="▦"
          />

          <NavItem
            name="Vehicles"
            icon="🚜"
          />

          <NavItem
            name="Live Tracking"
            icon="◉"
          />

          <NavItem
            name="AI Model"
            icon="◈"
          />

          <NavItem
            name="Analytics"
            icon="▥"
          />

        </nav>

        {/* Bottom */}
        <div className="absolute bottom-6 left-6 right-6">

          <NavItem
            name="Settings"
            icon="⚙"
          />

          <div className="mt-5 pt-5 border-t border-white/10">
            <p className="text-xs text-gray-500">
              System Status
            </p>

            <div className="flex items-center gap-2 mt-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />

              <span className="text-sm text-green-400">
                All systems operational
              </span>
            </div>
          </div>

        </div>

      </aside>

      {/* Main Content */}
      <section className="ml-64 min-h-screen">

        {/* Header */}
        <header className="h-20 border-b border-white/10
                           flex items-center justify-between
                           px-8">

          <div>
            <h2 className="text-xl font-semibold">
              Vehicle Overview
            </h2>

            <p className="text-sm text-gray-500">
              Real-time autonomous vehicle monitoring
            </p>
          </div>

          <div className="flex items-center gap-5">

            <div className="flex items-center gap-2
                            px-4 py-2 rounded-full
                            bg-green-500/10 border border-green-500/20">

              <span className="w-2 h-2 bg-green-500 rounded-full" />

              <span className="text-sm text-green-400">
                System Online
              </span>

            </div>

            <div className="w-10 h-10 rounded-full
                            bg-blue-600 flex items-center
                            justify-center font-semibold">
              HM
            </div>

          </div>

        </header>

        {/* Dashboard */}
        <div className="p-8">

          {/* Stats */}
          <div className="grid grid-cols-4 gap-5">

            <StatCard
              title="Current Speed"
              value="12.4"
              unit="m/s"
              change="+4.2%"
              icon="⚡"
            />

            <StatCard
              title="Schedule Drift"
              value="+18"
              unit="sec"
              change="Behind schedule"
              icon="◷"
            />

            <StatCard
              title="Route Progress"
              value="68"
              unit="%"
              change="12.4 km completed"
              icon="⌁"
            />

            <StatCard
              title="AI Accuracy"
              value="92.6"
              unit="%"
              change="Model confidence"
              icon="◈"
            />

          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-3 gap-5 mt-6">

            {/* Chart */}
            <div className="col-span-2 bg-[#0b111d]
                            border border-white/10
                            rounded-2xl p-6">

              <div className="flex justify-between items-center mb-6">

                <div>
                  <h3 className="font-semibold text-lg">
                    Speed & Schedule Drift
                  </h3>

                  <p className="text-sm text-gray-500">
                    Real-time vehicle performance
                  </p>
                </div>

                <select
                  className="bg-[#111827] border border-white/10
                             rounded-lg px-3 py-2 text-sm
                             text-gray-300"
                >
                  <option>Last 30 minutes</option>
                  <option>Last hour</option>
                  <option>Today</option>
                </select>

              </div>

              {/* Fake Chart */}
              <div className="h-64 relative">

                {/* Grid */}
                <div className="absolute inset-0
                                flex flex-col justify-between">

                  {[1, 2, 3, 4, 5].map((item) => (
                    <div
                      key={item}
                      className="border-t border-white/5"
                    />
                  ))}

                </div>

                {/* Chart line */}
                <svg
                  className="absolute inset-0 w-full h-full"
                  viewBox="0 0 800 250"
                  preserveAspectRatio="none"
                >
                  <polyline
                    points="
                    0,190
                    80,175
                    160,185
                    240,140
                    320,150
                    400,115
                    480,125
                    560,80
                    640,95
                    720,65
                    800,75
                    "
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="text-blue-500"
                  />

                  <polyline
                    points="
                    0,210
                    80,200
                    160,205
                    240,185
                    320,190
                    400,165
                    480,170
                    560,145
                    640,150
                    720,125
                    800,130
                    "
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray="8 8"
                    className="text-purple-500"
                  />
                </svg>

              </div>

              <div className="flex gap-6 mt-4 text-sm">

                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-blue-500 rounded-full" />
                  Actual Speed
                </div>

                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-purple-500 rounded-full" />
                  Target Speed
                </div>

              </div>

            </div>

            {/* Vehicle Status */}
            <div className="bg-[#0b111d]
                            border border-white/10
                            rounded-2xl p-6">

              <div className="flex justify-between mb-6">

                <h3 className="font-semibold text-lg">
                  Vehicle Status
                </h3>

                <span className="text-xs text-gray-500">
                  3 Vehicles
                </span>

              </div>

              <Vehicle
                name="Tractor Alpha"
                id="AV-001"
                status="Active"
                speed="12.4 m/s"
              />

              <Vehicle
                name="Tractor Beta"
                id="AV-002"
                status="Active"
                speed="10.8 m/s"
              />

              <Vehicle
                name="Tractor Gamma"
                id="AV-003"
                status="Idle"
                speed="0 m/s"
              />

            </div>

          </div>

          {/* Bottom */}
          <div className="grid grid-cols-3 gap-5 mt-6">

            {/* AI Control */}
            <div className="bg-[#0b111d]
                            border border-white/10
                            rounded-2xl p-6">

              <div className="flex justify-between">

                <div>
                  <h3 className="font-semibold text-lg">
                    AI Speed Control
                  </h3>

                  <p className="text-sm text-gray-500 mt-1">
                    Autonomous correction
                  </p>
                </div>

                <div className="w-10 h-10 rounded-xl
                                bg-purple-500/10
                                flex items-center justify-center">
                  ◈
                </div>

              </div>

              <div className="mt-6">

                <div className="flex justify-between mb-2">
                  <span className="text-gray-400">
                    Current Speed
                  </span>

                  <span className="font-semibold">
                    12.4 m/s
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">
                    AI Target
                  </span>

                  <span className="font-semibold text-blue-400">
                    13.2 m/s
                  </span>
                </div>

              </div>

              <button
                onClick={() => setAiActive(!aiActive)}
                className={`w-full mt-6 py-3 rounded-xl
                  font-semibold transition
                  ${
                    aiActive
                      ? "bg-green-500/10 text-green-400 border border-green-500/20"
                      : "bg-red-500/10 text-red-400 border border-red-500/20"
                  }`}
              >
                {aiActive
                  ? "● AI CONTROL ACTIVE"
                  : "● AI CONTROL OFF"}
              </button>

            </div>

            {/* Route */}
            <div className="bg-[#0b111d]
                            border border-white/10
                            rounded-2xl p-6">

              <h3 className="font-semibold text-lg">
                Current Route
              </h3>

              <p className="text-sm text-gray-500 mt-1">
                Field Route #A102
              </p>

              <div className="mt-6">

                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">
                    Progress
                  </span>

                  <span>
                    68%
                  </span>
                </div>

                <div className="w-full h-2 bg-white/5
                                rounded-full mt-3">

                  <div
                    className="h-2 bg-blue-500
                               rounded-full"
                    style={{ width: "68%" }}
                  />

                </div>

              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">

                <div>
                  <p className="text-xs text-gray-500">
                    Distance
                  </p>

                  <p className="font-semibold mt-1">
                    12.4 km
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">
                    Remaining
                  </p>

                  <p className="font-semibold mt-1">
                    5.8 km
                  </p>
                </div>

              </div>

            </div>

            {/* Prediction */}
            <div className="bg-[#0b111d]
                            border border-white/10
                            rounded-2xl p-6">

              <h3 className="font-semibold text-lg">
                ETA Prediction
              </h3>

              <p className="text-sm text-gray-500 mt-1">
                AI predicted completion
              </p>

              <div className="mt-7">

                <p className="text-4xl font-bold">
                  14:32
                </p>

                <p className="text-sm text-green-400 mt-2">
                  18 seconds correction applied
                </p>

              </div>

              <div className="mt-6 p-4 rounded-xl
                              bg-blue-500/5
                              border border-blue-500/10">

                <p className="text-xs text-gray-500">
                  Model recommendation
                </p>

                <p className="text-sm mt-2 text-blue-300">
                  Increase target speed by 0.8 m/s
                  to maintain schedule.
                </p>

              </div>

            </div>

          </div>

        </div>

      </section>

    </main>
  );
}


/* ---------------- Components ---------------- */

function NavItem({
  name,
  icon,
  active = false,
}: {
  name: string;
  icon: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl
        cursor-pointer transition
        ${
          active
            ? "bg-blue-600/10 text-blue-400"
            : "text-gray-400 hover:bg-white/5 hover:text-white"
        }`}
    >
      <span>{icon}</span>

      <span className="text-sm font-medium">
        {name}
      </span>
    </div>
  );
}


function StatCard({
  title,
  value,
  unit,
  change,
  icon,
}: {
  title: string;
  value: string;
  unit: string;
  change: string;
  icon: string;
}) {
  return (
    <div className="bg-[#0b111d]
                    border border-white/10
                    rounded-2xl p-5">

      <div className="flex justify-between">

        <div>
          <p className="text-sm text-gray-500">
            {title}
          </p>

          <div className="flex items-baseline gap-2 mt-3">
            <span className="text-2xl font-bold">
              {value}
            </span>

            <span className="text-sm text-gray-500">
              {unit}
            </span>
          </div>
        </div>

        <div className="w-10 h-10 rounded-xl
                        bg-blue-500/10
                        flex items-center justify-center">
          {icon}
        </div>

      </div>

      <p className="text-xs text-gray-500 mt-4">
        {change}
      </p>

    </div>
  );
}


function Vehicle({
  name,
  id,
  status,
  speed,
}: {
  name: string;
  id: string;
  status: string;
  speed: string;
}) {
  const active = status === "Active";

  return (
    <div className="flex items-center justify-between
                    py-4 border-b border-white/5 last:border-0">

      <div className="flex items-center gap-3">

        <div className="w-10 h-10 rounded-xl
                        bg-white/5
                        flex items-center justify-center">
          🚜
        </div>

        <div>
          <p className="text-sm font-medium">
            {name}
          </p>

          <p className="text-xs text-gray-500">
            {id}
          </p>
        </div>

      </div>

      <div className="text-right">

        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              active ? "bg-green-500" : "bg-gray-500"
            }`}
          />

          <span
            className={`text-xs ${
              active ? "text-green-400" : "text-gray-500"
            }`}
          >
            {status}
          </span>
        </div>

        <p className="text-xs text-gray-500 mt-1">
          {speed}
        </p>

      </div>

    </div>
  );
}