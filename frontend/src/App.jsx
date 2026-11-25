              time: alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : time,
            })),
            ...prev,
          ].slice(0, 50));
        }
      } catch (error) {
        if (!cancelled) setConnectionError("Backend connection unavailable. Make sure the FastAPI server is running.");
        console.error("Backend connection error:", error);
      }
    };

    fetchVitals();
    const interval = setInterval(fetchVitals, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [running]);

  // Dashboard thresholds from saved frontend settings
  const dashboardSettings = JSON.parse(localStorage.getItem("elderlycare_settings") || "{}");
  const maxHeartRate = dashboardSettings.heartRate ?? 100;
  const minOxygen = dashboardSettings.oxygen ?? 94;
  const maxTemperature = dashboardSettings.temperature ?? 38;

  const metrics = [
    { title: "Heart Rate", value: heartRate, unit: "BPM", icon: HeartPulse, color: "text-rose-500", bg: "bg-rose-50", abnormal: heartRate > maxHeartRate || heartRate < 50 },
    { title: "Blood Oxygen", value: oxygen, unit: "%", icon: Droplets, color: "text-blue-500", bg: "bg-blue-50", abnormal: oxygen < minOxygen },
    { title: "Temperature", value: temperature, unit: "°C", icon: Thermometer, color: "text-orange-500", bg: "bg-orange-50", abnormal: temperature > maxTemperature },
    { title: "Blood Pressure", value: `${bp.systolic}/${bp.diastolic}`, unit: "mmHg", icon: Activity, color: "text-violet-500", bg: "bg-violet-50", abnormal: bp.systolic > 140 || bp.diastolic > 90 },
  ];

  const navigation = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "profile", label: "Patient Profile", icon: Users },
    { id: "history", label: "Health History", icon: History },
    { id: "alerts", label: "Alerts", icon: Bell },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <aside className="w-full border-r bg-white p-6 md:w-64 md:min-h-screen md:flex md:flex-col">
        <div className="mb-8 flex items-center gap-3">
          <div className="rounded-xl bg-teal-600 p-3 text-white"><HeartPulse size={24} /></div>
          <div><h1 className="text-xl font-bold text-slate-800">ElderlyCare</h1><p className="text-xs text-slate-400">Health Monitoring System</p></div>
        </div>
        <nav className="space-y-2">
          {navigation.map((item) => { const Icon = item.icon; const active = activePage === item.id; return (
            <button key={item.id} onClick={() => setActivePage(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition ${active ? "bg-teal-50 text-teal-700 font-medium" : "text-slate-500 hover:bg-slate-100"}`}>
              <Icon size={20} />{item.label}
            </button>
          ); })}
        </nav>
        <div className="mt-8 rounded-2xl bg-teal-50 p-4 md:mt-auto">
          <ShieldCheck className="mb-2 text-teal-600" size={25} /><p className="font-semibold text-slate-800">Monitoring Status</p>
          <p className="mt-1 text-xs text-slate-500">{running ? "Simulation Running" : "Simulation Paused"}</p>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-5 md:p-8">
        {activePage === "profile" && <PatientProfile onBack={() => setActivePage("dashboard")} />}

        {activePage === "dashboard" && <>
          <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div><h2 className="text-2xl font-bold text-slate-800 md:text-3xl">Health Dashboard</h2><p className="mt-2 text-sm text-slate-500">Live simulated health monitoring (backend-connected)</p></div>
            <button onClick={() => setRunning(!running)} className={`flex items-center gap-2 rounded-xl px-5 py-3 font-medium text-white ${running ? "bg-rose-500" : "bg-teal-600"}`}>
              {running ? <Pause size={18} /> : <Play size={18} />}{running ? "Pause Monitoring" : "Resume Monitoring"}
            </button>
          </header>

          {connectionError && <div className="mb-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{connectionError}</div>}

          <section className="mb-8 rounded-2xl bg-gradient-to-r from-teal-700 to-cyan-700 p-6 text-white">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div><p className="text-sm text-teal-100">Patient Overview</p><h3 className="mt-2 text-2xl font-bold">Demo Patient</h3><p className="mt-2 text-sm text-teal-100">Age: 72 years · Simulated Data</p></div>
              <div className="rounded-xl bg-white/15 p-4"><p className="font-medium">● {running ? "Monitoring Running" : "Monitoring Paused"}</p><p className="mt-2 text-sm text-teal-100">Updates every 3 seconds</p></div>
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between"><h3 className="font-bold text-slate-800">Vital Measurements</h3><span className="rounded-lg bg-amber-100 px-3 py-1 text-xs text-amber-700">SIMULATED DATA</span></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => { const Icon = metric.icon; return (
                <div key={metric.title} className="rounded-2xl border bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between"><div className={`rounded-xl p-3 ${metric.bg}`}><Icon className={metric.color} size={23} /></div>
                    <span className={`rounded-full px-3 py-1 text-xs ${metric.abnormal ? "bg-rose-100 text-rose-700" : "bg-green-50 text-green-700"}`}>{metric.abnormal ? "Warning" : "Normal"}</span>
                  </div><p className="mt-5 text-sm text-slate-500">{metric.title}</p><div className="mt-2 flex items-baseline gap-2"><span className="text-2xl font-bold text-slate-800">{metric.value}</span><span className="text-sm text-slate-400">{metric.unit}</span></div>
                </div>
              ); })}
            </div>
          </section>

          <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="mb-6 font-bold text-slate-800">Live Health Trends</h3><div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%"><LineChart data={history}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="time" /><YAxis /><Tooltip />
                <Line type="monotone" dataKey="heartRate" stroke="#e11d48" name="Heart Rate" strokeWidth={3} />
                <Line type="monotone" dataKey="oxygen" stroke="#2563eb" name="Blood Oxygen" strokeWidth={3} />
              </LineChart></ResponsiveContainer>
            </div>
          </section>

          <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between"><h3 className="font-bold text-slate-800">Alert Center</h3><span className="rounded-full bg-rose-100 px-3 py-1 text-sm text-rose-700">{alerts.length} Alerts</span></div>
            {alerts.length === 0 ? <div className="rounded-xl bg-green-50 p-5 text-green-700"><ShieldCheck className="mb-2" size={25} />No abnormal simulated readings detected yet.</div> : <div className="space-y-3">
              {alerts.slice(0, 5).map((alert, index) => <div key={`${alert.time}-${index}`} className="flex items-start gap-3 rounded-xl bg-rose-50 p-4"><AlertTriangle className="mt-1 text-rose-600" /><div><p className="font-medium text-rose-700">{alert.message}</p><p className="mt-1 text-xs text-slate-500">{alert.time}</p></div></div>)}
            </div>}
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border bg-white p-6"><h3 className="font-bold text-slate-800">System Summary</h3><div className="mt-5 space-y-4">
              <div className="flex justify-between border-b pb-3"><span className="text-slate-500">Data Source</span><span className="font-medium">FastAPI Simulation</span></div>
              <div className="flex justify-between border-b pb-3"><span className="text-slate-500">Update Interval</span><span className="font-medium">3 Seconds</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Hardware</span><span className="font-medium text-teal-700">Not Required</span></div>
            </div></div>
            <div className="rounded-2xl border bg-white p-6"><h3 className="font-bold text-slate-800">About ElderlyCare</h3><p className="mt-4 text-sm leading-6 text-slate-600">ElderlyCare is a software-based elderly health monitoring demonstration. The system simulates health readings, visualizes health trends and generates threshold-based alerts.</p><p className="mt-4 text-xs text-slate-400">This is an academic demonstration. Readings are simulated and are not medical advice.</p></div>
          </section>
          <footer className="mt-8 text-center text-xs text-slate-400">ElderlyCare · Academic Project</footer>
        </>}

        {activePage === "history" && <HealthHistory history={history} onBack={() => setActivePage("dashboard")} />}
        {activePage === "alerts" && <Alerts alerts={alerts} onBack={() => setActivePage("dashboard")} />}
        {activePage === "settings" && <SettingsPage onBack={() => setActivePage("dashboard")} />}
      </main>
    </div>
  );
}

export default App;
