import { useState, useEffect } from "react";
import {
  HeartPulse, Activity, Thermometer, Droplets,
  Bell, LayoutDashboard, Users, History, Settings,
  ShieldCheck, Play, Pause, AlertTriangle
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from "recharts";

function App() {
  const [heartRate, setHeartRate] = useState(76);
  const [oxygen, setOxygen] = useState(98);
  const [temperature, setTemperature] = useState(36.8);
  const [bp, setBp] = useState({ systolic: 120, diastolic: 80 });

  const [running, setRunning] = useState(true);
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!running) return;

    const interval = setInterval(() => {
      const newHeart = Math.floor(65 + Math.random() * 35);
      const newOxygen = Math.floor(94 + Math.random() * 7);
      const newTemp = +(36.4 + Math.random() * 1.2).toFixed(1);
      const newSys = Math.floor(110 + Math.random() * 30);
      const newDia = Math.floor(70 + Math.random() * 20);

      setHeartRate(newHeart);
      setOxygen(newOxygen);
      setTemperature(newTemp);
      setBp({ systolic: newSys, diastolic: newDia });

      const time = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      setHistory((prev) =>
        [...prev, {
          time,
          heartRate: newHeart,
          oxygen: newOxygen,
        }].slice(-12)
      );

      const newAlerts = [];

      if (newHeart > 100 || newHeart < 50)
        newAlerts.push(`Heart rate warning: ${newHeart} BPM`);

      if (newOxygen < 95)
        newAlerts.push(`Oxygen warning: ${newOxygen}%`);

      if (newTemp > 37.5)
        newAlerts.push(`Temperature warning: ${newTemp}°C`);

      if (newAlerts.length > 0) {
        setAlerts((prev) => [
          ...newAlerts.map((message) => ({
            message,
            time,
          })),
          ...prev,
        ].slice(0, 10));
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [running]);

  const metrics = [
    {
      title: "Heart Rate",
      value: heartRate,
      unit: "BPM",
      icon: HeartPulse,
      color: "text-rose-500",
      bg: "bg-rose-50",
      abnormal: heartRate > 100 || heartRate < 50,
    },
    {
      title: "Blood Oxygen",
      value: oxygen,
      unit: "%",
      icon: Droplets,
      color: "text-blue-500",
      bg: "bg-blue-50",
      abnormal: oxygen < 95,
    },
    {
      title: "Temperature",
      value: temperature,
      unit: "°C",
      icon: Thermometer,
      color: "text-orange-500",
      bg: "bg-orange-50",
      abnormal: temperature > 37.5,
    },
    {
      title: "Blood Pressure",
      value: `${bp.systolic}/${bp.diastolic}`,
      unit: "mmHg",
      icon: Activity,
      color: "text-violet-500",
      bg: "bg-violet-50",
      abnormal: bp.systolic > 140 || bp.diastolic > 90,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 md:flex">

      {/* Sidebar */}
      <aside className="hidden w-64 border-r bg-white p-6 md:flex md:flex-col">
        <div className="mb-10 flex items-center gap-3">
          <div className="rounded-xl bg-teal-600 p-3 text-white">
            <HeartPulse size={24} />
          </div>

          <div>
            <h1 className="text-xl font-bold text-slate-800">
              ElderlyCare
            </h1>
            <p className="text-xs text-slate-400">
              Health Monitoring
            </p>
          </div>
        </div>

        <nav className="space-y-2">
          <div className="flex items-center gap-3 rounded-xl bg-teal-50 px-4 py-3 text-teal-700">
            <LayoutDashboard size={20} /> Dashboard
          </div>

          <div className="flex items-center gap-3 px-4 py-3 text-slate-500">
            <Users size={20} /> Patient Profile
          </div>

          <div className="flex items-center gap-3 px-4 py-3 text-slate-500">
            <History size={20} /> Health History
          </div>

          <div className="flex items-center gap-3 px-4 py-3 text-slate-500">
            <Bell size={20} /> Alerts
          </div>

          <div className="flex items-center gap-3 px-4 py-3 text-slate-500">
            <Settings size={20} /> Settings
          </div>
        </nav>

        <div className="mt-auto rounded-2xl bg-teal-50 p-4">
          <ShieldCheck className="mb-2 text-teal-600" size={25} />
          <p className="font-semibold text-slate-800">
            Monitoring Active
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Simulated system
          </p>
        </div>
      </aside>

      {/* Dashboard */}
      <main className="flex-1 p-5 md:p-8">

        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 md:text-3xl">
              Health Dashboard
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Live simulated health monitoring
            </p>
          </div>

          <button
            onClick={() => setRunning(!running)}
            className={`flex items-center gap-2 rounded-xl px-5 py-3 font-medium text-white ${
              running ? "bg-rose-500" : "bg-teal-600"
            }`}
          >
            {running ? <Pause size={18} /> : <Play size={18} />}
            {running ? "Pause" : "Resume"}
          </button>
        </header>

        {/* Patient Banner */}
        <section className="mb-8 rounded-2xl bg-gradient-to-r from-teal-700 to-cyan-700 p-6 text-white">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <p className="text-sm text-teal-100">
                Patient Overview
              </p>

              <h3 className="mt-2 text-2xl font-bold">
                Demo Patient
              </h3>

              <p className="mt-2 text-sm text-teal-100">
                Age: 72 years · Simulation
              </p>
            </div>

            <div className="rounded-xl bg-white/15 p-4">
              <p className="font-medium">
                ● {running ? "Monitoring Running" : "Monitoring Paused"}
              </p>

              <p className="mt-2 text-sm text-teal-100">
                Update every 3 seconds
              </p>
            </div>
          </div>
        </section>

        {/* Vitals */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">
              Vital Measurements
            </h3>

            <span className="rounded-lg bg-amber-100 px-3 py-1 text-xs text-amber-700">
              SIMULATED
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => {
              const Icon = metric.icon;

              return (
                <div
                  key={metric.title}
                  className="rounded-2xl border bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className={`rounded-xl p-3 ${metric.bg}`}>
                      <Icon className={metric.color} size={23} />
                    </div>

                    <span className={`rounded-full px-3 py-1 text-xs ${
                      metric.abnormal
                        ? "bg-rose-100 text-rose-700"
                        : "bg-green-50 text-green-700"
                    }`}>
                      {metric.abnormal ? "Warning" : "Normal"}
                    </span>
                  </div>

                  <p className="mt-5 text-sm text-slate-500">
                    {metric.title}
                  </p>

                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-800">
                      {metric.value}
                    </span>

                    <span className="text-sm text-slate-400">
                      {metric.unit}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Graph */}
        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <h3 className="mb-6 font-bold text-slate-800">
            Live Health Trends
          </h3>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="heartRate"
                  stroke="#e11d48"
                  name="Heart Rate"
                  strokeWidth={3}
                />
                <Line
                  type="monotone"
                  dataKey="oxygen"
                  stroke="#2563eb"
                  name="Oxygen (%)"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Alerts */}
        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">
              Alert Center
            </h3>

            <span className="rounded-full bg-rose-100 px-3 py-1 text-sm text-rose-700">
              {alerts.length} Alerts
            </span>
          </div>

          {alerts.length === 0 ? (
            <div className="rounded-xl bg-green-50 p-5 text-green-700">
              <ShieldCheck className="mb-2" size={25} />
              No abnormal simulated readings detected yet.
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 rounded-xl bg-rose-50 p-4"
                >
                  <AlertTriangle className="mt-1 text-rose-600" />

                  <div>
                    <p className="font-medium text-rose-700">
                      {alert.message}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {alert.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Summary */}
        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-6">
            <h3 className="font-bold text-slate-800">
              System Summary
            </h3>

            <div className="mt-5 space-y-4">
              <div className="flex justify-between border-b pb-3">
                <span className="text-slate-500">
                  Data Source
                </span>

                <span className="font-medium">
                  Random simulation
                </span>
              </div>

              <div className="flex justify-between border-b pb-3">
                <span className="text-slate-500">
                  Update interval
                </span>

                <span className="font-medium">
                  3 seconds
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">
                  Hardware
                </span>

                <span className="font-medium text-teal-700">
                  Not required
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6">
            <h3 className="font-bold text-slate-800">
              About This Project
            </h3>

            <p className="mt-4 text-sm leading-6 text-slate-600">
              ElderlyCare is a software-based health monitoring
              demonstration. It simulates health measurements,
              visualizes trends and demonstrates threshold-based
              alerts.
            </p>

            <p className="mt-4 text-xs text-slate-400">
              This is not a medical device. Simulated thresholds
              and readings are for demonstration only.
            </p>
          </div>
        </section>

        <footer className="mt-8 text-center text-xs text-slate-400">
          ElderlyCare · Academic Project
        </footer>

      </main>
    </div>
  );
}

export default App;