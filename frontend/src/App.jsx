import { useCallback, useEffect, useState } from 'react';
import { HeartPulse, Activity, Thermometer, Droplets, Bell, LayoutDashboard, Users, History, Settings, ShieldCheck, Play, Pause, AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const fmtTime = (value) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--';
const fmtDateTime = (value) => value ? new Date(value).toLocaleString() : '--';

const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'profile', label: 'Patient Profile', icon: Users },
  { id: 'history', label: 'Health History', icon: History },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function App() {
  const [patient, setPatient] = useState(null);
  const [vital, setVital] = useState(null);
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [running, setRunning] = useState(false);
  const [scenario, setScenario] = useState('normal');
  const [busy, setBusy] = useState(false);
  const [acknowledgingId, setAcknowledgingId] = useState(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [initialLoading, setInitialLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState('');

  const loadHistoryAlerts = useCallback(async (pid) => {
    const [historyResponse, alertsResponse] = await Promise.all([
      fetch(`${API}/vitals/${pid}/history?limit=40`),
      fetch(`${API}/alerts?patient_id=${pid}&limit=30`),
    ]);
    if (!historyResponse.ok || !alertsResponse.ok) {
      throw new Error('Unable to load history or alerts from backend.');
    }
    const [historyData, alertsData] = await Promise.all([historyResponse.json(), alertsResponse.json()]);
    setHistory(historyData.map((reading) => ({ ...reading, time: fmtTime(reading.timestamp) })));
    setAlerts(alertsData);
  }, []);

  const initialize = useCallback(async () => {
    try {
      const response = await fetch(`${API}/patients`);
      if (!response.ok) throw new Error('Backend connection failed. Start FastAPI on port 8000.');
      setError('');
      const patients = await response.json();
      if (!patients.length) throw new Error('No patient record found. Create a patient first.');
      const currentPatient = patients[0];
      setPatient(currentPatient);

      const latestResponse = await fetch(`${API}/vitals/${currentPatient.id}/latest`);
      if (latestResponse.ok) {
        const latest = await latestResponse.json();
        setVital(latest);
        setPrediction(latest.ml_prediction || null);
      } else if (latestResponse.status === 404) {
        setVital(null);
        setPrediction(null);
      } else {
        throw new Error(`Unable to load the latest reading (${latestResponse.status}).`);
      }
      await loadHistoryAlerts(currentPatient.id);
    } catch (e) {
      setError(e.message || 'Could not connect to backend.');
    } finally {
      setInitialLoading(false);
    }
  }, [loadHistoryAlerts]);

  useEffect(() => { void Promise.resolve().then(initialize); }, [initialize]);

  const refreshPage = useCallback(async (page) => {
    if (!patient || page === 'dashboard' || page === 'settings') return;
    setPageLoading(true);
    try {
      setError('');
      if (page === 'profile') {
        const response = await fetch(`${API}/patients/${patient.id}`);
        if (!response.ok) throw new Error(`Unable to load patient profile (${response.status}).`);
        setPatient(await response.json());
      } else {
        await loadHistoryAlerts(patient.id);
      }
    } catch (e) {
      setError(e.message || 'Unable to refresh this page.');
    } finally {
      setPageLoading(false);
    }
  }, [patient, loadHistoryAlerts]);

  const navigate = (page) => {
    setActivePage(page);
    refreshPage(page);
  };

  const makeReading = useCallback(async (chosenScenario = scenario) => {
    if (!patient || busy) return;
    setBusy(true);
    try {
      setError('');
      const response = await fetch(`${API}/vitals/${patient.id}/simulate?scenario=${chosenScenario}`, { method: 'POST' });
      if (!response.ok) throw new Error(`Simulation API failed (${response.status}).`);
      const data = await response.json();
      setVital(data);
      setPrediction(data.ml_prediction || null);
      await loadHistoryAlerts(patient.id);
    } catch (e) {
      setError(e.message || 'Failed to fetch simulated reading.');
    } finally {
      setBusy(false);
    }
  }, [patient, scenario, busy, loadHistoryAlerts]);

  useEffect(() => {
    if (!running || !patient) return undefined;
    const timer = setInterval(() => { makeReading(scenario); }, 3000);
    return () => clearInterval(timer);
  }, [running, patient, scenario, makeReading]);

  const acknowledge = async (id) => {
    setAcknowledgingId(id);
    try {
      setError('');
      const response = await fetch(`${API}/alerts/${id}/acknowledge`, { method: 'PATCH' });
      if (!response.ok) throw new Error(`Acknowledge failed (${response.status}).`);
      await loadHistoryAlerts(patient.id);
    } catch (e) {
      setError(e.message || 'Unable to acknowledge alert.');
    } finally {
      setAcknowledgingId(null);
    }
  };

  const metrics = vital ? [
    { title: 'Heart Rate', value: vital.heart_rate, unit: 'BPM', icon: HeartPulse, abnormal: vital.heart_rate > 100 || vital.heart_rate < 60 },
    { title: 'Blood Oxygen', value: vital.spo2, unit: '%', icon: Droplets, abnormal: vital.spo2 < 95 },
    { title: 'Temperature', value: vital.temperature, unit: '°C', icon: Thermometer, abnormal: vital.temperature > 37.5 || vital.temperature < 36 },
    { title: 'Blood Pressure', value: `${vital.systolic_bp}/${vital.diastolic_bp}`, unit: 'mmHg', icon: Activity, abnormal: vital.systolic_bp >= 130 || vital.diastolic_bp >= 85 },
  ] : [];
  const pageTitles = {
    dashboard: ['Health Dashboard', 'Readings, alerts and ML inference from FastAPI'],
    profile: ['Patient Profile', 'Patient details loaded from the backend'],
    history: ['Health History', 'Saved readings and trends from the backend'],
    alerts: ['Alerts', 'Review and acknowledge patient alerts'],
    settings: ['Settings', 'Configure local monitoring behavior'],
  };
  const newestFirst = [...history].reverse();
  const title = pageTitles[activePage];

  const renderNavigation = (mobile = false) => (
    <nav aria-label="Main navigation" className={mobile ? 'flex gap-2 overflow-x-auto pb-2 md:hidden' : 'space-y-2'}>
      {navigation.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => navigate(id)}
          aria-current={activePage === id ? 'page' : undefined}
          className={`flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
            activePage === id
              ? 'bg-teal-50 font-semibold text-teal-700'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          } ${mobile ? 'whitespace-nowrap' : 'w-full'}`}
        >
          <Icon size={20} />{label}
        </button>
      ))}
    </nav>
  );

  const renderAlerts = () => (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-bold text-slate-800">Alert Center</h3>
        <span className="rounded-full bg-rose-100 px-3 py-1 text-sm text-rose-700">
          {alerts.filter((alert) => !alert.acknowledged).length} unacknowledged
        </span>
      </div>
      {pageLoading ? <p className="text-sm text-slate-500">Loading alerts...</p> : alerts.length === 0
        ? <div className="rounded-xl bg-green-50 p-5 text-green-700">No stored alerts yet.</div>
        : <div className="space-y-3">
          {alerts.map((alert) => (
            <div key={alert.id} className={`flex flex-wrap items-start justify-between gap-3 rounded-xl p-4 ${alert.severity === 'critical' ? 'bg-rose-50' : 'bg-amber-50'}`}>
              <div className="flex min-w-0 gap-3">
                <AlertTriangle className={alert.severity === 'critical' ? 'shrink-0 text-rose-600' : 'shrink-0 text-amber-600'} />
                <div>
                  <p className="font-medium">{alert.message}</p>
                  <p className="mt-1 text-xs capitalize text-slate-500">{alert.severity} · {fmtDateTime(alert.timestamp)}</p>
                </div>
              </div>
              {!alert.acknowledged
                ? <button
                  type="button"
                  disabled={acknowledgingId === alert.id}
                  onClick={() => acknowledge(alert.id)}
                  className="rounded-lg border bg-white px-3 py-2 text-sm disabled:cursor-wait disabled:opacity-50"
                >
                  {acknowledgingId === alert.id ? 'Acknowledging...' : 'Acknowledge'}
                </button>
                : <span className="text-xs text-slate-500">Acknowledged</span>}
            </div>
          ))}
        </div>}
    </section>
  );

  return <div className="min-h-screen bg-slate-50 md:flex">
    <aside className="hidden w-64 shrink-0 border-r bg-white p-6 md:flex md:flex-col">
      <div className="mb-10 flex items-center gap-3">
        <div className="rounded-xl bg-teal-600 p-3 text-white"><HeartPulse size={24} /></div>
        <div><h1 className="text-xl font-bold text-slate-800">ElderlyCare</h1><p className="text-xs text-slate-400">Health Monitoring</p></div>
      </div>
      {renderNavigation()}
      <div className="mt-auto rounded-2xl bg-teal-50 p-4">
        <ShieldCheck className="mb-2 text-teal-600" size={25} />
        <p className="font-semibold text-slate-800">Backend Connected</p>
        <p className="mt-1 text-xs text-slate-500">API-driven monitoring</p>
      </div>
    </aside>

    <main className="min-w-0 flex-1 p-4 sm:p-5 md:p-8">
      <div className="mb-5 md:hidden">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-teal-600 p-2 text-white"><HeartPulse size={22} /></div>
          <div><h1 className="text-lg font-bold text-slate-800">ElderlyCare</h1><p className="text-xs text-slate-400">Health Monitoring</p></div>
        </div>
        {renderNavigation(true)}
      </div>

      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 md:mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 md:text-3xl">{title[0]}</h2>
          <p className="mt-2 text-sm text-slate-500">{title[1]}</p>
        </div>
        {activePage === 'dashboard'
          ? <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => makeReading(scenario)} disabled={!patient || busy} className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-white disabled:opacity-50">
              <RefreshCw size={18} className={busy ? 'animate-spin' : ''} />{busy ? 'Generating...' : 'Generate Reading'}
            </button>
            <button type="button" onClick={() => setRunning((current) => !current)} className={`flex items-center gap-2 rounded-xl px-5 py-3 font-medium text-white ${running ? 'bg-rose-500' : 'bg-slate-800'}`}>
              {running ? <Pause size={18} /> : <Play size={18} />}{running ? 'Pause' : 'Auto Start'}
            </button>
          </div>
          : <button type="button" onClick={() => navigate('dashboard')} className="flex items-center gap-2 rounded-xl border bg-white px-4 py-3 font-medium text-slate-700 hover:bg-slate-50">
            <ArrowLeft size={18} />Back to Dashboard
          </button>}
      </header>

      {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
        {error}<button type="button" className="ml-3 underline" onClick={() => { setError(''); setInitialLoading(true); initialize(); }}>Retry</button>
      </div>}

      {(initialLoading || pageLoading) && <div role="status" className="mb-5 rounded-xl border bg-white p-4 text-sm text-slate-500">
        {initialLoading ? 'Loading patient and monitoring data...' : 'Refreshing page data...'}
      </div>}

      {!initialLoading && activePage === 'dashboard' && <>
        <section className="mb-6 rounded-2xl bg-gradient-to-r from-teal-700 to-cyan-700 p-6 text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-teal-100">Patient Overview</p>
              <h3 className="mt-2 text-2xl font-bold">{patient?.name || 'Loading patient...'}</h3>
              <p className="mt-2 text-sm text-teal-100">Age: {patient?.age ?? '--'} years · Simulated data</p>
            </div>
            <div className="rounded-xl bg-white/15 p-4">
              <p>{running ? '● Auto-monitoring running' : '● Monitoring paused'}</p>
              <p className="mt-2 text-sm text-teal-100">{vital?.timestamp ? `Last update: ${fmtTime(vital.timestamp)}` : 'Waiting for first reading'}</p>
            </div>
          </div>
        </section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-slate-800">Vital Measurements</h3>
          <select aria-label="Monitoring scenario" value={scenario} onChange={(event) => setScenario(event.target.value)} className="rounded-lg border bg-white px-3 py-2 text-sm">
            <option value="normal">Normal scenario</option><option value="warning">Warning scenario</option><option value="critical">Critical scenario</option>
          </select>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return <div key={metric.title} className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-slate-100 p-3"><Icon className="text-teal-700" size={23} /></div>
                <span className={`rounded-full px-3 py-1 text-xs ${metric.abnormal ? 'bg-rose-100 text-rose-700' : 'bg-green-50 text-green-700'}`}>{metric.abnormal ? 'Check' : 'Normal'}</span>
              </div>
              <p className="mt-5 text-sm text-slate-500">{metric.title}</p>
              <div className="mt-2 flex items-baseline gap-2"><span className="text-2xl font-bold text-slate-800">{metric.value}</span><span className="text-sm text-slate-400">{metric.unit}</span></div>
            </div>;
          })}
          {!vital && <div className="rounded-2xl border bg-white p-5 text-sm text-slate-500 sm:col-span-2 xl:col-span-4">No readings yet. Generate a reading to begin monitoring.</div>}
        </div>
        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <h3 className="mb-5 font-bold text-slate-800">Health Trends (stored backend readings)</h3>
          <div className="h-72 min-w-0"><ResponsiveContainer width="100%" height="100%"><LineChart data={history}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="time" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="heart_rate" stroke="#e11d48" name="Heart Rate" strokeWidth={2} /><Line type="monotone" dataKey="spo2" stroke="#2563eb" name="SpO₂" strokeWidth={2} /></LineChart></ResponsiveContainer></div>
        </section>
        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><h3 className="font-bold">ML Risk Prediction</h3><span className="rounded-lg bg-indigo-50 px-3 py-1 text-xs text-indigo-700">Random Forest</span></div>
          {prediction
            ? <><p className="text-lg font-semibold">Predicted category: <span className="capitalize">{prediction.risk_level}</span></p><div className="mt-3 grid gap-3 sm:grid-cols-3">{Object.entries(prediction.probabilities || {}).map(([key, value]) => <div key={key} className="rounded-xl bg-slate-50 p-3"><p className="capitalize text-sm text-slate-500">{key}</p><p className="text-xl font-bold">{(value * 100).toFixed(1)}%</p></div>)}</div><p className="mt-3 text-xs text-slate-400">{prediction.disclaimer}</p></>
            : <p className="text-sm text-slate-500">Generate a reading to see the model prediction.</p>}
        </section>
        <div className="mt-8">{renderAlerts()}</div>
        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-6"><h3 className="font-bold">System Summary</h3><div className="mt-5 space-y-4"><div className="flex justify-between border-b pb-3"><span className="text-slate-500">Data source</span><span className="font-medium">Backend simulation</span></div><div className="flex justify-between border-b pb-3"><span className="text-slate-500">Update interval</span><span className="font-medium">3 seconds</span></div><div className="flex justify-between"><span className="text-slate-500">ML method</span><span className="font-medium">Synthetic-data Random Forest</span></div></div></div>
          <div className="rounded-2xl border bg-white p-6"><h3 className="font-bold">About ElderlyCare</h3><p className="mt-4 text-sm leading-6 text-slate-600">A software-based prototype for simulating vital measurements, generating threshold alerts and demonstrating a machine-learning classification workflow.</p><p className="mt-4 text-xs text-slate-400">Not a medical device. The synthetic ML model is not clinically validated and must not be used for medical decisions.</p></div>
        </section>
      </>}

      {!initialLoading && activePage === 'profile' && patient && <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-4">
          <div className="rounded-2xl bg-teal-50 p-4 text-teal-700"><Users size={28} /></div>
          <div><h3 className="text-xl font-bold text-slate-800">{patient.name}</h3><p className="text-sm text-slate-500">Patient ID: {patient.id}</p></div>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          {[['Age', patient.age == null ? '--' : `${patient.age} years`], ['Gender', patient.gender || '--'], ['Phone', patient.phone || '--'], ['Emergency Contact', patient.emergency_contact || '--'], ['Medical Conditions', patient.medical_conditions || 'None recorded']].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-slate-50 p-4"><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-1 break-words font-medium text-slate-800">{value}</dd></div>
          ))}
        </dl>
      </section>}

      {!initialLoading && activePage === 'history' && <div className="space-y-6">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h3 className="mb-5 font-bold text-slate-800">Vital Trends</h3>
          {history.length
            ? <div className="h-72 min-w-0"><ResponsiveContainer width="100%" height="100%"><LineChart data={history}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="time" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="heart_rate" stroke="#e11d48" name="Heart Rate (BPM)" strokeWidth={2} /><Line type="monotone" dataKey="spo2" stroke="#2563eb" name="SpO₂ (%)" strokeWidth={2} /><Line type="monotone" dataKey="temperature" stroke="#d97706" name="Temperature (°C)" strokeWidth={2} /></LineChart></ResponsiveContainer></div>
            : <p className="text-sm text-slate-500">No saved readings are available yet.</p>}
        </section>
        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b p-6"><h3 className="font-bold text-slate-800">Saved Readings</h3><p className="mt-1 text-sm text-slate-500">Showing up to 40 recent readings.</p></div>
          {pageLoading ? <p className="p-6 text-sm text-slate-500">Loading readings...</p> : history.length === 0
            ? <p className="p-6 text-sm text-slate-500">No saved readings are available yet.</p>
            : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Timestamp</th><th className="px-4 py-3">Heart Rate</th><th className="px-4 py-3">SpO₂</th><th className="px-4 py-3">Temperature</th><th className="px-4 py-3">Blood Pressure</th><th className="px-4 py-3">Status</th></tr></thead>
              <tbody className="divide-y">{newestFirst.map((reading) => <tr key={reading.id} className="text-slate-700">
                <td className="whitespace-nowrap px-4 py-3">{fmtDateTime(reading.timestamp)}</td><td className="px-4 py-3">{reading.heart_rate} BPM</td><td className="px-4 py-3">{reading.spo2}%</td><td className="px-4 py-3">{reading.temperature} °C</td><td className="px-4 py-3">{reading.systolic_bp}/{reading.diastolic_bp} mmHg</td><td className="px-4 py-3 capitalize">{reading.status}</td>
              </tr>)}</tbody>
            </table></div>}
        </section>
      </div>}

      {!initialLoading && activePage === 'alerts' && renderAlerts()}

      {!initialLoading && activePage === 'settings' && <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-teal-50 p-3 text-teal-700"><Activity size={22} /></div><div><h3 className="font-bold text-slate-800">Monitoring Scenario</h3><p className="text-sm text-slate-500">Applied to generated backend readings.</p></div></div>
          <label htmlFor="settings-scenario" className="mb-2 block text-sm font-medium text-slate-700">Scenario</label>
          <select id="settings-scenario" value={scenario} onChange={(event) => setScenario(event.target.value)} className="w-full rounded-lg border bg-white px-3 py-3 text-sm">
            <option value="normal">Normal scenario</option><option value="warning">Warning scenario</option><option value="critical">Critical scenario</option>
          </select>
          <p className="mt-3 text-xs leading-5 text-slate-500">This selection is held in the current page session and sent through the existing simulation endpoint. No settings are saved to the backend.</p>
          <button type="button" onClick={() => makeReading(scenario)} disabled={!patient || busy} className="mt-5 flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-white disabled:opacity-50">
            <RefreshCw size={18} className={busy ? 'animate-spin' : ''} />{busy ? 'Generating...' : 'Generate Reading'}
          </button>
        </section>
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-slate-100 p-3 text-slate-700">{running ? <Pause size={22} /> : <Play size={22} />}</div><div><h3 className="font-bold text-slate-800">Auto-monitoring</h3><p className="text-sm text-slate-500">Generate a reading every 3 seconds.</p></div></div>
          <p className="mb-5 text-sm text-slate-600">Current status: <span className="font-semibold">{running ? 'Running' : 'Paused'}</span></p>
          <button type="button" onClick={() => setRunning((current) => !current)} disabled={!patient} className={`flex items-center gap-2 rounded-xl px-5 py-3 font-medium text-white disabled:opacity-50 ${running ? 'bg-rose-500' : 'bg-slate-800'}`}>
            {running ? <Pause size={18} /> : <Play size={18} />}{running ? 'Pause monitoring' : 'Start monitoring'}
          </button>
        </section>
      </div>}

      <footer className="mt-8 text-center text-xs text-slate-400">ElderlyCare · Academic Project</footer>
    </main>
  </div>;
}
