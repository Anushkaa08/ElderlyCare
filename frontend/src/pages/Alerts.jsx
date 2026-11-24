
import { useState } from "react";
import { ArrowLeft, Bell, CheckCircle2, AlertTriangle } from "lucide-react";

function Alerts({ alerts = [], onBack }) {
  const [acknowledged, setAcknowledged] = useState([]);

  const handleAcknowledge = (index) => {
    setAcknowledged((prev) =>
      prev.includes(index) ? prev : [...prev, index]
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-5 md:p-8">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-xl border bg-white p-3 hover:bg-slate-100"
        >
          <ArrowLeft size={20} />
        </button>

        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            Alerts
          </h2>
          <p className="text-sm text-slate-500">
            Monitoring alerts and notifications
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-2 font-semibold text-amber-800">
          <AlertTriangle size={20} />
          Simulated Alert System
        </div>
        <p className="mt-1 text-sm text-amber-700">
          Alerts displayed here are generated using simulated readings.
          This system is not a real medical monitoring device.
        </p>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <Bell size={21} className="text-teal-600" />
            Alert History
          </h3>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
            {alerts.length} Total
          </span>
        </div>

        {alerts.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCircle2 size={45} className="mx-auto mb-3 text-teal-500" />
            <h3 className="font-semibold text-slate-700">
              No Alerts
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              No simulated alerts have been generated yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert, index) => {
              const isAcknowledged = acknowledged.includes(index);

              return (
                <div
                  key={index}
                  className={`rounded-xl border p-4 ${
                    isAcknowledged
                      ? "border-slate-200 bg-slate-50"
                      : "border-red-200 bg-red-50"
                  }`}
                >
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle
                          size={20}
                          className={
                            isAcknowledged
                              ? "text-slate-500"
                              : "text-red-600"
                          }
                        />

                        <h4 className="font-semibold text-slate-800">
                          {alert.message ||
                            alert.title ||
                            alert.type ||
                            "Monitoring Alert"}
                        </h4>
                      </div>

                      <p className="mt-2 text-sm text-slate-600">
                        {alert.timestamp || alert.time
                          ? new Date(
                              alert.timestamp || alert.time
                            ).toLocaleString()
                          : "Time unavailable"}
                      </p>

                      {alert.value !== undefined && (
                        <p className="mt-1 text-sm text-slate-600">
                          Value: {alert.value}
                        </p>
                      )}
                    </div>

                    <div>
                      {isAcknowledged ? (
                        <span className="flex items-center gap-2 text-sm font-medium text-green-700">
                          <CheckCircle2 size={18} />
                          Acknowledged
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAcknowledge(index)}
                          className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                        >
                          Acknowledge
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Alerts;
