import { useState } from "react";
import { UserRound, Save, ArrowLeft } from "lucide-react";

function PatientProfile({ onBack }) {
  const [profile, setProfile] = useState({
    name: "Demo Patient",
    age: "72",
    gender: "Female",
    phone: "",
    emergencyContact: "",
    bloodGroup: "Unknown",
    conditions: "",
    medications: "",
    address: "",
  });

  const [saved, setSaved] = useState(false);

  const handleChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
    setSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem("elderlyCareProfile", JSON.stringify(profile));
    setSaved(true);
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
            Patient Profile
          </h2>
          <p className="text-sm text-slate-500">
            Manage patient information
          </p>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-teal-50 p-3 text-teal-700">
            <UserRound size={25} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">
              Personal Information
            </h3>
            <p className="text-sm text-slate-500">
              Update the patient's details below.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {[
            ["name", "Full Name"],
            ["age", "Age"],
            ["gender", "Gender"],
            ["phone", "Phone Number"],
            ["emergencyContact", "Emergency Contact"],
            ["bloodGroup", "Blood Group"],
            ["conditions", "Medical Conditions"],
            ["medications", "Current Medications"],
            ["address", "Address"],
          ].map(([key, label]) => (
            <div key={key}>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {label}
              </label>

              <input
                name={key}
                value={profile[key]}
                onChange={handleChange}
                placeholder={`Enter ${label.toLowerCase()}`}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-3 font-medium text-white hover:bg-teal-700"
          >
            <Save size={18} />
            Save Profile
          </button>

          {saved && (
            <p className="font-medium text-green-600">
              Profile saved successfully!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default PatientProfile;