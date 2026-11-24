
import { useState } from "react";

export default function Settings({ onBack }) {
  const saved = JSON.parse(localStorage.getItem("elderlycare_settings") || "{}");

  const [heartRate, setHeartRate] = useState(saved.heartRate ?? 100);
  const [oxygen, setOxygen] = useState(saved.oxygen ?? 94);
  const [temperature, setTemperature] = useState(saved.temperature ?? 38);
  const [notifications, setNotifications] = useState(saved.notifications ?? true);

  const saveSettings = () => {
    localStorage.setItem(
      "elderlycare_settings",
      JSON.stringify({
        heartRate,
        oxygen,
        temperature,
        notifications,
      })
    );

    alert("Settings saved successfully!");
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-800">
          Settings
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Configure simulated monitoring and alert preferences.
        </p>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-6">
        <h3 className="text-lg font-semibold text-slate-800">
          Health Alert Thresholds
        </h3>

        <div>
          <label className="block mb-2 font-medium">
            Maximum Heart Rate (bpm)
          </label>
          <input
            type="number"
            value={heartRate}
            onChange={(e) => setHeartRate(Number(e.target.value))}
            className="w-full rounded-xl border p-3"
          />
        </div>

        <div>
          <label className="block mb-2 font-medium">
            Minimum Oxygen Level (%)
          </label>
          <input
            type="number"
            value={oxygen}
            onChange={(e) => setOxygen(Number(e.target.value))}
            className="w-full rounded-xl border p-3"
          />
        </div>

        <div>
          <label className="block mb-2 font-medium">
            Maximum Temperature (°C)
          </label>
          <input
            type="number"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="w-full rounded-xl border p-3"
          />
        </div>

        <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
          <div>
            <p className="font-medium">Notifications</p>
            <p className="text-sm text-slate-500">
              Enable or disable simulated alerts
            </p>
          </div>

          <input
            type="checkbox"
            checked={notifications}
            onChange={(e) => setNotifications(e.target.checked)}
            className="h-5 w-5"
          />
        </div>

        <button
          onClick={saveSettings}
          className="rounded-xl bg-teal-600 px-6 py-3 font-medium text-white hover:bg-teal-700"
        >
          Save Settings
        </button>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-slate-800">
          System Information
        </h3>

        <div className="mt-4 space-y-3 text-sm text-slate-600">
          <p>System: ElderlyCare</p>
          <p>Monitoring Mode: Simulation</p>
          <p>Project Type: Academic Prototype</p>
          <p>Hardware: Not Connected</p>
        </div>
      </div>

      <p className="text-center text-xs text-slate-400">
        This project uses simulated health data and is not a medical device.
      </p>

      <button
        onClick={onBack}
        className="rounded-xl border border-slate-300 px-5 py-3 text-slate-600 hover:bg-slate-50"
      >
        Back to Dashboard
      </button>
    </div>
  );
}
