"use client";
import { useState, ChangeEvent } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { UploadCloud, Zap, Database, CheckCircle, BrainCircuit } from "lucide-react";

interface DataStats {
  columns: string[];
}

interface Result {
  accuracy: number;
}

export default function Home() {
  const [step, setStep] = useState(1);
  const [dataStats, setDataStats] = useState<DataStats | null>(null);
  const [selectedTarget, setSelectedTarget] = useState("");
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [modelType, setModelType] = useState("logistic");
  const [epochs, setEpochs] = useState(100);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  // --- HANDLERS ---

    const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        // 1. Validations
        const files = e.currentTarget.files;
        if (!files || files.length === 0) return;

        const f = files[0];
        // Client-side validation
        if (f.size > 10 * 1024 * 1024) { // 10MB limit
            setError("File size must be less than 10MB");
            return;
        }
        const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
        if (!allowedTypes.includes(f.type)) {
            setError("Please upload a CSV or Excel file");
            return;
        }

        setLoading(true);
        setError(null);
        const formData = new FormData();
        formData.append("file", f);

    try {
      // 2. Call Python Backend
      const res = await axios.post(`${backendUrl}/upload`, formData);
      setDataStats(res.data);
      setLoading(false);
      setStep(2);
    } catch {
      setError("Error: Backend is offline. Please check your backend server.");
      setLoading(false);
    }
  };

  const handleTrain = async () => {
    setTrainingLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("target", selectedTarget);
    formData.append("features", JSON.stringify(selectedFeatures));
    formData.append("model_type", modelType);
    formData.append("epochs", epochs.toString());

    try {
      const res = await axios.post(`${backendUrl}/train`, formData);
      setResult(res.data);
      setTrainingLoading(false);
      // Wait 1.5 seconds so user enjoys the animation
      setTimeout(() => setStep(4), 1500);
    } catch {
      setError("Training failed. Please select a valid target column (categorical or numeric).");
      setTrainingLoading(false);
      setStep(2);
    }
  };

  // --- UI RENDER ---

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans overflow-hidden relative selection:bg-purple-500/30">
      
      {/* BACKGROUND ACCENTS */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* HEADER */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/60 backdrop-blur-md px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
            <Zap className="text-purple-500" fill="currentColor" size={20} />
            <h1 className="text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
                AI STUDIO <span className="ml-2 text-[10px] text-gray-500 border border-white/10 px-2 py-0.5 rounded-full uppercase tracking-wider">PRO</span>
            </h1>
        </div>
        <div className="hidden md:flex gap-4 text-xs font-mono text-gray-500">
            <span>CPU: READY</span>
            <span className="text-green-500">GPU: ONLINE</span>
        </div>
      </nav>

      {/* MAIN CONTAINER */}
      <main className="pt-32 max-w-5xl mx-auto px-6 relative z-10">
        
        {/* === STEP 1: UPLOAD === */}
        {step === 1 && (
          <motion.div initial={{opacity: 0, y: 30}} animate={{opacity: 1, y: 0}} className="text-center mt-12">
            <span className="inline-block py-1 px-3 rounded-full bg-purple-500/10 text-purple-400 text-xs font-mono tracking-widest border border-purple-500/20 mb-6">
                V2.0 // NO-CODE PIPELINE
            </span>
            <h2 className="text-5xl md:text-7xl font-bold mb-8 tracking-tight leading-tight">
              Predict the <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500">Future.</span> <br />
              <span className="text-gray-500 text-3xl md:text-5xl">Without writing code.</span>
            </h2>
            
            <p className="text-gray-400 mb-12 max-w-lg mx-auto text-lg leading-relaxed">
              Drag & drop your CSV or Excel file. Our neural engine automatically maps features, normalizes vectors, and trains predictive models.
            </p>

            <div className="relative group w-full max-w-xl mx-auto h-72 border border-dashed border-gray-800 rounded-3xl hover:border-purple-500 hover:bg-purple-900/5 transition-all duration-300 flex flex-col items-center justify-center bg-[#0A0A0A]">
                <input type="file" onChange={handleUpload} className="absolute inset-0 opacity-0 cursor-pointer z-20" accept=".csv,.xls,.xlsx" />
                <div className="group-hover:scale-110 transition-transform duration-500 z-10 flex flex-col items-center">
                    {loading ? (
                        <>
                          <div className="animate-spin w-12 h-12 border-2 border-purple-500 border-t-transparent rounded-full mb-4"></div>
                          <span className="text-sm font-mono text-purple-400 animate-pulse">ANALYZING SCHEMA...</span>
                        </>
                    ) : (
                        <>
                          <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center mb-4 border border-white/5 group-hover:border-purple-500/50 group-hover:bg-black transition-colors">
                              <UploadCloud size={30} className="text-gray-400 group-hover:text-purple-400" />
                          </div>
                          <span className="text-gray-200 font-medium text-lg">Drop Dataset Here</span>
                          <span className="text-xs text-gray-500 mt-2 font-mono">SUPPORTS .CSV .XLSX</span>
                        </>
                    )}
                </div>
            </div>
            {error && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
                    {error}
                </div>
            )}
          </motion.div>
        )}

        {/* === STEP 2: CONFIGURATION === */}
        {step === 2 && dataStats && (
            <motion.div initial={{opacity: 0, scale: 0.98}} animate={{opacity: 1, scale: 1}} transition={{duration: 0.4}}>
                <div className="flex justify-between items-end mb-10 border-b border-white/5 pb-4">
                    <div>
                        <h3 className="text-2xl font-bold">Model Configuration</h3>
                        <p className="text-gray-500 text-sm">Define your input features and hyperparameters.</p>
                    </div>
                    <button onClick={() => setStep(1)} className="text-xs text-gray-500 hover:text-white transition-colors">ABORT PROCESS</button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* LEFT CARD: FEATURES */}
                    <div className="bg-[#0f0f0f] p-8 rounded-2xl border border-white/5 relative group hover:border-purple-500/20 transition-all">
                        <div className="absolute top-0 right-0 p-4 opacity-50"><Database className="text-purple-900" size={80} /></div>
                        
                        <div className="relative z-10">
                            <h4 className="text-purple-400 font-bold uppercase text-xs tracking-wider mb-6 flex items-center gap-2">
                                <Database size={14}/> 1. Feature Mapping
                            </h4>

                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-300 mb-2">Target Variable (Goal)</label>
                                <select className="w-full bg-black border border-gray-800 rounded-xl p-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all appearance-none cursor-pointer"
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                        const v = e.target.value;
                                        setSelectedTarget(v);
                                        setSelectedFeatures((prev: string[]) => prev.filter((x: string) => x !== v));
                                    }}>
                                    <option value="">Select Column...</option>
                                    {dataStats.columns.map((c: string) => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Input Features</label>
                                <div className="h-64 overflow-y-auto bg-black rounded-xl border border-gray-800 p-2 space-y-1 custom-scrollbar">
                                    {dataStats.columns.map((c: string) => (
                                        c !== selectedTarget && (
                                        <div key={c} onClick={() => setSelectedFeatures((prev: string[]) => prev.includes(c) ? prev.filter((x: string) => x !== c) : [...prev, c])}
                                             className={`p-3 rounded-lg cursor-pointer text-sm font-mono flex items-center justify-between transition-all select-none border border-transparent ${selectedFeatures.includes(c) ? "bg-purple-500/10 text-purple-300 border-purple-500/30" : "hover:bg-gray-900 text-gray-500"}`}>
                                            {c} 
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedFeatures.includes(c) ? "border-purple-500 bg-purple-500 text-white" : "border-gray-700"}`}>
                                                {selectedFeatures.includes(c) && <CheckCircle size={10} />}
                                            </div>
                                        </div>)
                                    ))}
                                </div>
                                <div className="mt-2 text-right text-xs text-gray-600">{selectedFeatures.length} features selected</div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT CARD: HYPERPARAMETERS */}
                    <div className="bg-[#0f0f0f] p-8 rounded-2xl border border-white/5 relative group hover:border-blue-500/20 transition-all flex flex-col justify-between">
                         <div className="absolute top-0 right-0 p-4 opacity-50"><BrainCircuit className="text-blue-900" size={80} /></div>
                         
                         <div className="relative z-10">
                             <h4 className="text-blue-400 font-bold uppercase text-xs tracking-wider mb-6 flex items-center gap-2">
                                <BrainCircuit size={14}/> 2. Neural Architecture
                             </h4>

                             <div className="space-y-3 mb-8">
                                <label className="block text-sm font-medium text-gray-300">Algorithm Type</label>
                                {[{id:"logistic", name:"Logistic Regression (Fast)"}, {id:"forest", name:"Random Forest (Accurate)"}, {id:"neural", name:"Multi-Layer Perceptron (Neural)"}].map((m) => (
                                    <div key={m.id} onClick={() => setModelType(m.id)}
                                         className={`cursor-pointer px-4 py-3 rounded-xl border transition-all ${modelType === m.id ? "bg-white text-black border-white shadow-lg" : "bg-black border-gray-800 text-gray-500 hover:border-gray-700"}`}>
                                        <div className="font-bold text-sm">{m.name}</div>
                                    </div>
                                ))}
                             </div>

                             <div className="bg-black rounded-xl p-4 border border-gray-800">
                                 <div className="flex justify-between mb-2">
                                    <label className="text-xs font-mono text-gray-500 uppercase">Training Iterations</label>
                                    <span className="text-xs font-mono text-blue-400">{epochs} EPOCHS</span>
                                 </div>
                                 <input type="range" min="100" max="1000" step="50" value={epochs} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEpochs(Number(e.target.value))}
                                   className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                             </div>
                         </div>
                         
                         <button onClick={handleTrain} disabled={!selectedTarget || selectedFeatures.length === 0}
                             className="w-full mt-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-bold text-md shadow-[0_0_30px_rgba(79,70,229,0.3)] hover:shadow-[0_0_50px_rgba(79,70,229,0.5)] transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none">
                            INITIALIZE TRAINING SEQ ⚡
                         </button>
                    </div>
                </div>
            </motion.div>
        )}

        {/* === STEP 3: LOADING SIMULATION === */}
        {step === 3 && (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                 <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden relative mb-8">
                    <motion.div 
                        initial={{width: 0}} animate={{width: "100%"}} transition={{duration: 2.5, ease: "easeInOut"}} 
                        className="h-full bg-gradient-to-r from-purple-500 to-blue-500" 
                    />
                 </div>
                 <div className="text-center">
                     <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500 animate-pulse">
                         Training in Progress
                     </h2>
                     <div className="mt-4 font-mono text-sm text-gray-500 space-y-1">
                         <p className="text-purple-400">[info] Constructing tensors...</p>
                         <p className="text-blue-400">[info] Normalizing features ({epochs} epochs)...</p>
                         <p className="text-green-400">[info] Converging gradients...</p>
                     </div>
                 </div>
            </div>
        )}

        {/* === STEP 4: FINAL RESULTS (Corrected) === */}
        {step === 4 && result && (
            <motion.div initial={{y: 20, opacity: 0}} animate={{y: 0, opacity: 1}} className="max-w-2xl mx-auto mt-16 text-center">
                 
                 <div className="bg-[#0A0A0A] rounded-[2rem] p-1 border border-white/10 shadow-2xl relative">
                     <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50"></div>
                     
                     <div className="bg-[#050505] rounded-[1.8rem] p-12">
                         <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/20">
                            <CheckCircle size={40} className="text-green-500" />
                         </div>

                        {/* --- FIXED THIS SECTION --- */}
                         <div className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-600 tracking-tighter mb-2">
                             {result?.accuracy !== undefined && result.accuracy !== null 
                                ? (result.accuracy * 100).toFixed(1) + "%" 
                                : "0%"}
                         </div>
                        {/* ------------------------- */}
                         
                         <p className="text-gray-500 font-mono tracking-widest text-sm uppercase mb-10">Predictive Accuracy Score</p>
                         
                         <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                <p className="text-[10px] text-gray-500 font-mono uppercase mb-1">Model Engine</p>
                                <p className="font-bold text-gray-200">{modelType.toUpperCase()}</p>
                            </div>
                            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                <p className="text-[10px] text-gray-500 font-mono uppercase mb-1">Iterations</p>
                                <p className="font-bold text-gray-200">{epochs}</p>
                            </div>
                         </div>
                     </div>
                 </div>

                 <button onClick={() => window.location.reload()} className="mt-12 px-8 py-3 rounded-full border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all text-sm font-medium">
                    Run New Pipeline
                 </button>
            </motion.div>
        )}
      </main>
    </div>
  );
}