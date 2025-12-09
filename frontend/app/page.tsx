"use client";
import { useState, type ChangeEvent } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { UploadCloud, Zap, Database, CheckCircle, BrainCircuit, Network } from "lucide-react";

export default function Home() {
  const [step, setStep] = useState(1);
  const [dataStats, setDataStats] = useState<any>(null);
  const [selectedTarget, setSelectedTarget] = useState("");
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [taskType, setTaskType] = useState("auto"); // auto, classification, regression
  const [modelType, setModelType] = useState("logistic");
  const [epochs, setEpochs] = useState(100);
  const [standardizeCols, setStandardizeCols] = useState<string[]>([]);
  const [normalizeCols, setNormalizeCols] = useState<string[]>([]);
  const [splitRatio, setSplitRatio] = useState(0.2);
  const [maxDepth, setMaxDepth] = useState<number | null>(5);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [numericColumns, setNumericColumns] = useState<string[]>([]);
  const [targetStats, setTargetStats] = useState<any>(null);
  const [urlValidation, setUrlValidation] = useState<any>(null);
  const [includeOnlyReachable, setIncludeOnlyReachable] = useState(false);
  const [allowedTargetValues, setAllowedTargetValues] = useState<string[]>([]);

  const handleTargetChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    setSelectedTarget(v);
    setSelectedFeatures((prev: string[]) => prev.filter((x: string) => x !== v));
    if (v) {
      try {
        const resp = await axios.get('http://localhost:8000/target_stats', { params: { col: v } });
        setTargetStats(resp.data);
      } catch (err) {
        setTargetStats(null);
      }
    } else {
      setTargetStats(null);
    }
  };

  // helpers to determine which UI controls should be enabled for the selected model
  const supportsPreprocessing = modelType === 'logistic';
  const supportsEpochs = modelType !== 'decision_tree';
  const supportsMaxDepth = modelType === 'decision_tree';
  
  // Available models per task type
  const classificationModels = [
    { id: 'logistic', name: 'Logistic Regression', icon: '🎯', desc: 'Fast & interpretable' },
    { id: 'decision_tree', name: 'Decision Tree', icon: '🌳', desc: 'Tree-based splitting' },
    { id: 'random_forest', name: 'Random Forest', icon: '🌲', desc: 'Ensemble trees' }
  ];
  const regressionModels = [
    { id: 'logistic', name: 'Linear Regression', icon: '📈', desc: 'Simple linear fit' },
    { id: 'decision_tree', name: 'Decision Tree', icon: '🌳', desc: 'Tree-based prediction' },
    { id: 'random_forest', name: 'Random Forest', icon: '🌲', desc: 'Ensemble trees' }
  ];
  const availableModels = taskType === 'regression' ? regressionModels : classificationModels;
  // columns that can be preprocessed: numeric AND currently selected as feature
  const preprocessableCols = numericColumns.filter((c) => selectedFeatures.includes(c));

  // Auto-detect suitable targets for each task type
  const getClassificationTargets = () => {
    if (!dataStats?.column_types) return [];
    return dataStats.columns.filter((col: string) => {
      const type = dataStats.column_types[col];
      // Classification: categorical (non-numeric) or numeric with few unique values
      return !/int|float|number/i.test(type) || 
             (dataStats.columns_unique_counts?.[col] && dataStats.columns_unique_counts[col] <= 20);
    });
  };

  const getRegressionTargets = () => {
    if (!dataStats?.column_types) return [];
    // Regression: numeric columns only
    return dataStats.columns.filter((col: string) => {
      const type = dataStats.column_types[col];
      return /int|float|number/i.test(type);
    });
  };

  // Get suitable targets based on current task type
  const suitableTargets = taskType === 'regression' ? getRegressionTargets() : getClassificationTargets();

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files || files.length === 0) return;
    setLoading(true);
    const f = files[0];
    const formData = new FormData();
    formData.append("file", f);

    try {
      const res = await axios.post("http://localhost:8000/upload", formData);
      setDataStats(res.data);
      // derive numeric columns if returned
      const types = res.data.column_types || {};
      const nums: string[] = [];
      Object.keys(types).forEach((k) => {
        const t = types[k];
        if (/int|float|number/i.test(t)) nums.push(k);
      });
      setNumericColumns(nums);
      setLoading(false);
      setStep(2);
    } catch (err) {
      alert("Error: Python Backend is offline. Run the backend on port 8000.");
      setLoading(false);
    }
  };

  const handleTrain = async () => {
    // Client-side validation to prevent backend errors (e.g. single-class target)
    if (!selectedTarget) {
      alert('Please select a target variable before training.');
      return;
    }
    const colTypes = dataStats?.column_types || {};
    const uniqueCounts = dataStats?.columns_unique_counts || {};

    // If user forced regression/classification, validate accordingly. If auto, replicate backend heuristic.
    if (taskType === 'regression') {
      if (!/int|float|number/i.test(colTypes[selectedTarget] || '')) {
        alert('Regression: selected target must be numeric. Choose a numeric column.');
        return;
      }
    } else if (taskType === 'classification') {
      if ((uniqueCounts[selectedTarget] || 0) < 2) {
        alert('Classification: target must have at least 2 distinct classes. Choose a different column.');
        return;
      }
    } else {
      // auto: if numeric and (float dtype or many uniques) -> regression, else classification
      const isNumeric = /int|float|number/i.test(colTypes[selectedTarget] || '');
      const uniq = uniqueCounts[selectedTarget] || 0;
      const autoRegression = isNumeric && (String(colTypes[selectedTarget]).startsWith('float') || uniq > 20);
      if (!autoRegression && uniq < 2) {
        alert('Selected target appears unsuitable for classification (fewer than 2 classes). Choose a different target or switch task type.');
        return;
      }
    }

    setStep(3);
    const formData = new FormData();
    formData.append("target", selectedTarget);
    formData.append("features", JSON.stringify(selectedFeatures));
    // send canonical model_type ids (we already use 'logistic' | 'decision_tree' | 'random_forest')
    formData.append("model_type", modelType);
    formData.append("task_type", taskType);
    if (supportsEpochs) formData.append("epochs", epochs.toString());
    formData.append("preprocess_standardize", JSON.stringify(standardizeCols));
    formData.append("preprocess_normalize", JSON.stringify(normalizeCols));
    formData.append("split_ratio", String(splitRatio));
    if (supportsMaxDepth && maxDepth != null) formData.append("max_depth", String(maxDepth));
    if (allowedTargetValues && allowedTargetValues.length > 0) {
      formData.append("allowed_target_values", JSON.stringify(allowedTargetValues));
    }

    try {
      const res = await axios.post("http://localhost:8000/train", formData);
      setResult(res.data);
      setTimeout(() => setStep(4), 1000);
    } catch (err: any) {
      console.error("Training error:", err);
      const msg = err?.response?.data?.detail || err?.message || "Training failed. Check backend logs.";
      alert(msg);
      setStep(2);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans overflow-hidden relative selection:bg-purple-500/30">
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Blurry neural-network / ML algorithm structure graphic - non-interactive background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10">
        <svg viewBox="0 0 1200 400" className="w-full max-w-5xl opacity-10 filter blur-2xl" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="g1" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.9" />
            </linearGradient>
            <filter id="f1" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
          </defs>

          {/* connections */}
          <g stroke="url(#g1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9">
            <line x1="120" y1="80" x2="360" y2="160" />
            <line x1="120" y1="160" x2="360" y2="160" />
            <line x1="120" y1="240" x2="360" y2="160" />

            <line x1="360" y1="160" x2="720" y2="120" />
            <line x1="360" y1="160" x2="720" y2="200" />

            <line x1="720" y1="120" x2="1040" y2="80" />
            <line x1="720" y1="200" x2="1040" y2="240" />
          </g>

          {/* nodes */}
          <g filter="url(#f1)">
            {/* left layer (input) */}
            <circle cx="120" cy="80" r="12" fill="#8b5cf6" />
            <circle cx="120" cy="160" r="12" fill="#06b6d4" />
            <circle cx="120" cy="240" r="12" fill="#7c3aed" />

            {/* hidden layer */}
            <circle cx="360" cy="100" r="10" fill="#06b6d4" />
            <circle cx="360" cy="160" r="14" fill="#8b5cf6" />
            <circle cx="360" cy="220" r="10" fill="#06b6d4" />

            {/* bottleneck / middle */}
            <circle cx="720" cy="120" r="16" fill="#7c3aed" />
            <circle cx="720" cy="200" r="12" fill="#06b6d4" />

            {/* output layer */}
            <circle cx="1040" cy="80" r="18" fill="#06b6d4" />
            <circle cx="1040" cy="240" r="14" fill="#8b5cf6" />
          </g>

          {/* subtle animated glow (CSS uses opacity animation via Tailwind animate-pulse on parent is simpler) */}
        </svg>
      </div>

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

      <main className="pt-32 max-w-5xl mx-auto px-6 relative z-10">
        {step === 1 && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center mt-12">
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
          </motion.div>
        )}

        {step === 2 && dataStats && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
            <div className="flex justify-between items-end mb-10 border-b border-white/5 pb-4">
              <div>
                <h3 className="text-2xl font-bold">Model Configuration</h3>
                <p className="text-gray-500 text-sm">Define your input features and hyperparameters.</p>
              </div>
              <button onClick={() => setStep(1)} className="text-xs text-gray-500 hover:text-white transition-colors">ABORT PROCESS</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Left Column: Feature Mapping */}
              <div className="lg:col-span-1 bg-[#0f0f0f] p-8 rounded-2xl border border-white/5 relative group hover:border-purple-500/20 transition-all">
                <div className="absolute top-0 right-0 p-4 opacity-50"><Database className="text-purple-900" size={80} /></div>
                <div className="relative z-10">
                  <h4 className="text-purple-400 font-bold uppercase text-xs tracking-wider mb-6 flex items-center gap-2">
                    <Database size={14}/> 1. Feature Mapping
                  </h4>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Target Variable (Goal)</label>
                    <div className="relative">
                      <select className="w-full bg-black border border-gray-800 rounded-xl p-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all appearance-none cursor-pointer"
                        onChange={handleTargetChange}
                        value={selectedTarget}>
                        <option value="">Select Column... ({taskType === 'regression' ? 'numeric only' : 'categorical or few unique values'})</option>
                        {dataStats.columns.map((c: string) => {
                          const isSuitable = suitableTargets.includes(c);
                          return (
                            <option key={c} value={c} disabled={!isSuitable}>
                              {c} {!isSuitable ? '(unsupported for ' + taskType + ')' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    {selectedTarget && !suitableTargets.includes(selectedTarget) && (
                      <p className="text-xs text-red-400 mt-1">⚠️ Selected target may not work for {taskType} task. Switch task type or select a different target.</p>
                    )}
                    {targetStats && (
                      <div className="mt-3 bg-black p-3 rounded-md border border-gray-800 text-xs text-gray-300">
                        <div className="flex justify-between items-center mb-2">
                          <div className="font-mono text-[11px]">{targetStats.column}</div>
                          <div className="text-gray-500 text-[11px]">Unique: <span className="font-mono">{targetStats.n_unique}</span></div>
                        </div>
                        {targetStats.n_unique > 40 ? (
                          <div className="text-yellow-400 text-[11px]">⚠️ This target has many classes — consider grouping rare labels or switching task type.</div>
                        ) : (
                          <div className="max-h-36 overflow-auto">
                            <table className="w-full text-left text-xs">
                              <tbody>
                                {targetStats.top.slice(0,10).map((r: any, i: number) => (
                                  <tr key={i} className="border-t border-white/5">
                                    <td className="py-1 font-mono text-[11px] text-gray-200 truncate">{r.value}</td>
                                    <td className="py-1 text-right text-gray-400 font-mono text-[11px]">{r.count}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {/* If top values look like URLs, offer validation */}
                        {targetStats.top && targetStats.top.length > 0 && targetStats.top[0].value?.startsWith && targetStats.top[0].value.startsWith('http') && (
                          <div className="mt-3">
                            <div className="flex items-center gap-2">
                              <button onClick={async () => {
                                const urls = targetStats.top.slice(0,50).map((r: any) => r.value);
                                try {
                                  setUrlValidation({checking: true});
                                  const resp = await axios.post('http://localhost:8000/check_urls', urls);
                                  setUrlValidation(resp.data);
                                } catch (err) {
                                  setUrlValidation({error: true});
                                }
                              }} className="py-1 px-3 rounded bg-blue-600 text-white text-xs">Validate top URLs</button>
                              {urlValidation && !urlValidation.checking && !urlValidation.error && (
                                <div className="text-xs text-gray-400">Reachable: <span className="font-mono text-white">{urlValidation.reachable}</span> / {urlValidation.checked}</div>
                              )}
                            </div>

                            {urlValidation && urlValidation.results && (
                              <div className="mt-2 text-xs text-gray-400">
                                <label className="inline-flex items-center gap-2"><input type="checkbox" className="accent-purple-500" checked={includeOnlyReachable} onChange={(e) => {
                                  setIncludeOnlyReachable(e.target.checked);
                                  if (e.target.checked) {
                                    const allowed = urlValidation.results.filter((r: any) => r.ok).map((r: any) => r.url);
                                    // store as JSON string for handleTrain to send
                                    setAllowedTargetValues(allowed);
                                  } else {
                                    setAllowedTargetValues([]);
                                  }
                                }} /> Include only reachable URLs</label>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Input Features</label>
                    <div className="h-48 overflow-y-auto bg-black rounded-xl border border-gray-800 p-2 space-y-1 custom-scrollbar">
                      {dataStats.columns.map((c: string) => (
                        c !== selectedTarget && (
                          <div key={c} onClick={() => setSelectedFeatures((prev: string[]) => prev.includes(c) ? prev.filter((x: string) => x !== c) : [...prev, c])}
                            className={`p-3 rounded-lg cursor-pointer text-sm font-mono flex items-center justify-between transition-all select-none border border-transparent ${selectedFeatures.includes(c) ? "bg-purple-500/10 text-purple-300 border-purple-500/30" : "hover:bg-gray-900 text-gray-500"}`}>
                            {c}
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedFeatures.includes(c) ? "border-purple-500 bg-purple-500 text-white" : "border-gray-700"}`}>
                              {selectedFeatures.includes(c) && <CheckCircle size={10} />}
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                    <div className="mt-2 text-right text-xs text-gray-600">{selectedFeatures.length} features selected</div>
                  </div>
                </div>
              </div>

              {/* Middle & Right Columns: Configuration */}
              <div className="lg:col-span-2 bg-[#0f0f0f] p-8 rounded-2xl border border-white/5 relative group hover:border-blue-500/20 transition-all flex flex-col justify-between">
                <div className="absolute top-0 right-0 p-4 opacity-30"><BrainCircuit className="text-blue-900" size={100} /></div>
                <div className="relative z-10">
                  <h4 className="text-blue-400 font-bold uppercase text-xs tracking-wider mb-6 flex items-center gap-2">
                    <BrainCircuit size={14}/> 2. Configuration & Training
                  </h4>

                  {/* Two-column grid for preprocessing and split */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {/* Preprocessing */}
                    <div className="space-y-3">
                      <label className="block text-xs font-medium text-gray-300">Preprocessing</label>
                      <div className="bg-black p-3 rounded-lg border border-gray-800">
                        <div className="text-[10px] font-mono text-gray-400 mb-2">📊 Standardize</div>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {preprocessableCols.length === 0 ? (
                            <div className="p-2 text-[10px] text-gray-500">Select numeric features first</div>
                          ) : (
                            preprocessableCols.map((c) => (
                              <div key={c}
                                className={`p-1 rounded text-[10px] ${standardizeCols.includes(c) ? 'bg-purple-600 text-white' : 'text-gray-400'} ${supportsPreprocessing ? 'cursor-pointer hover:bg-gray-900' : 'opacity-50 cursor-not-allowed'}`}
                                onClick={() => {
                                  if (!supportsPreprocessing) return;
                                  setStandardizeCols((prev: string[]) => prev.includes(c) ? prev.filter((x: string) => x !== c) : [...prev, c]);
                                  setNormalizeCols((prev: string[]) => prev.filter((x: string) => x !== c));
                                }}>
                                {c}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="bg-black p-3 rounded-lg border border-gray-800">
                        <div className="text-xs font-mono text-gray-400 mb-2">Normalize (min-max)</div>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {preprocessableCols.length === 0 ? (
                            <div className="p-2 text-xs text-gray-500">Select numeric features from the left to enable preprocessing.</div>
                          ) : (
                            preprocessableCols.map((c) => (
                              <div key={c}
                                className={`p-2 rounded-md text-sm ${normalizeCols.includes(c) ? 'bg-purple-600 text-white' : 'text-gray-400'} ${supportsPreprocessing ? 'cursor-pointer hover:bg-gray-900' : 'opacity-50 cursor-not-allowed'}`}
                                onClick={() => {
                                  if (!supportsPreprocessing) return;
                                  setNormalizeCols((prev: string[]) => prev.includes(c) ? prev.filter((x: string) => x !== c) : [...prev, c]);
                                  setStandardizeCols((prev: string[]) => prev.filter((x: string) => x !== c));
                                }}>
                                {c}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 mb-6">
                    <label className="block text-sm font-medium text-gray-300">Train / Test Split</label>
                    <div className="bg-black rounded-xl p-4 border border-gray-800">
                      {/* Preset ratio buttons */}
                      <div className="flex gap-2 mb-4">
                        {[
                          { label: '70-30', ratio: 0.3 },
                          { label: '80-20', ratio: 0.2 },
                          { label: '90-10', ratio: 0.1 }
                        ].map((preset) => (
                          <button key={preset.label} onClick={() => setSplitRatio(preset.ratio)}
                            className={`flex-1 py-2 px-2 rounded-lg text-xs font-mono uppercase transition-all border ${Math.abs(splitRatio - preset.ratio) < 0.01 ? 'bg-purple-600 border-purple-500 text-white' : 'bg-gray-900 border-gray-800 text-gray-500 hover:border-gray-700'}`}>
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      {/* Slider with visual feedback */}
                      <div className="mb-4">
                        <div className="flex justify-between mb-2 text-xs text-gray-400">
                          <span>Train / Test</span>
                          <span className="font-mono text-purple-400">{Math.round((1-splitRatio)*100)}% / {Math.round(splitRatio*100)}%</span>
                        </div>
                        <input type="range" min="0.1" max="0.5" step="0.05" value={splitRatio} onChange={(e) => setSplitRatio(Number(e.target.value))}
                          className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                      </div>

                      {/* Visual split representation */}
                      <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-gray-800 mb-3">
                        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-l-full" style={{ width: `${(1-splitRatio)*100}%` }}></div>
                        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-r-full" style={{ width: `${splitRatio*100}%` }}></div>
                      </div>

                      {/* Clear split summary */}
                      <div className="text-xs text-gray-400 space-y-1">
                        <p>🔵 Train: <span className="text-blue-400 font-mono">{Math.round((1-splitRatio)*100)}%</span> — Model learns from this data</p>
                        <p>🟠 Test: <span className="text-orange-400 font-mono">{Math.round(splitRatio*100)}%</span> — Model evaluation on unseen data</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 mb-4">
                    <label className="block text-sm font-medium text-gray-300">Task Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['auto', 'classification', 'regression'].map((tt) => (
                        <button key={tt} onClick={() => setTaskType(tt)}
                          className={`py-2 px-3 rounded-lg text-xs font-mono uppercase transition-all border ${taskType === tt ? 'bg-blue-600 border-blue-500 text-white' : 'bg-black border-gray-800 text-gray-500 hover:border-gray-700'}`}>
                          {tt === 'auto' ? 'Auto' : tt === 'classification' ? 'Classify' : 'Regress'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 mb-4">
                    <label className="block text-sm font-medium text-gray-300">Model Type</label>
                    <div className="space-y-2">
                      {availableModels.map((m) => (
                        <div key={m.id} onClick={() => setModelType(m.id)}
                          className={`cursor-pointer px-4 py-4 rounded-xl border transition-all flex items-center gap-4 relative overflow-hidden group ${modelType === m.id ? "bg-gradient-to-r from-white/10 to-transparent text-white border-white/30 shadow-lg shadow-white/20" : "bg-black border-gray-800 text-gray-500 hover:border-gray-700 hover:bg-gray-900/20"}`}>
                          {/* Background animation for selected */}
                          {modelType === m.id && (
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-transparent to-transparent group-hover:from-purple-500/20 transition-all" />
                          )}
                          <div className="text-3xl filter drop-shadow-lg">{m.icon}</div>
                          <div className="flex-1 relative z-10">
                            <div className="font-bold text-sm">{m.name}</div>
                            <div className="text-xs text-gray-400">{m.desc}</div>
                          </div>
                          {modelType === m.id && (
                            <div className="w-3 h-3 rounded-full bg-white relative z-10 animate-pulse" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-black rounded-xl p-4 border border-gray-800 mb-4">
                    <div className="flex justify-between mb-2">
                      <label className="text-xs font-mono text-gray-500 uppercase">
                        {modelType === 'random_forest' ? 'Number of Trees / Estimators' : 'Epochs / Iterations'}
                      </label>
                      <span className="text-xs font-mono text-purple-400">{epochs}</span>
                    </div>
                    <input type="range" min="10" max="500" step="10" value={epochs} onChange={(e) => setEpochs(Number(e.target.value))}
                      className={`w-full h-1 bg-gray-800 rounded-lg appearance-none ${supportsEpochs ? 'cursor-pointer accent-purple-500' : 'opacity-40 cursor-not-allowed'}`} disabled={!supportsEpochs} />
                    <div className="text-xs text-gray-500 mt-1">
                      {modelType === 'random_forest' && (supportsEpochs ? 'More trees = better accuracy but slower.' : 'Epochs disabled for this model.')}
                      {modelType === 'decision_tree' && 'Epochs are not applicable to Decision Trees and are disabled.'}
                      {modelType === 'logistic' && 'More iterations for better convergence.'}
                    </div>
                  </div>

                  {supportsMaxDepth && (
                    <div className="bg-black rounded-xl p-4 border border-gray-800 mb-4">
                      <label className="text-xs font-mono text-gray-500 uppercase">Max Tree Depth (optional)</label>
                      <input type="number" value={maxDepth ?? ''} onChange={(e) => setMaxDepth(e.target.value === '' ? null : Number(e.target.value))}
                        className="w-full mt-2 p-2 bg-[#0a0a0a] border border-gray-800 rounded text-white" placeholder="e.g. 5" />
                      <div className="text-xs text-gray-500 mt-1">Controls tree complexity (prevents overfitting)</div>
                    </div>
                  )}

                  {/* Summary stats before training */}
                  <div className="bg-gradient-to-br from-gray-900/50 to-purple-900/20 rounded-xl p-4 border border-purple-500/20 mb-4 mt-6">
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <p className="text-2xl font-bold text-purple-400">{selectedFeatures.length}</p>
                        <p className="text-[10px] text-gray-500">Features</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-blue-400">{Math.round((1-splitRatio)*100)}%</p>
                        <p className="text-[10px] text-gray-500">Train</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-orange-400">{Math.round(splitRatio*100)}%</p>
                        <p className="text-[10px] text-gray-500">Test</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-400">{epochs}</p>
                        <p className="text-[10px] text-gray-500">Epochs</p>
                      </div>
                    </div>
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

        {step === 3 && (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden relative mb-8">
              <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 2.5, ease: "easeInOut" }}
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500" />
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

        {step === 4 && result && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="max-w-2xl mx-auto mt-16 text-center">
            <div className="bg-[#0A0A0A] rounded-[2rem] p-1 border border-white/10 shadow-2xl relative">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50"></div>
              <div className="bg-[#050505] rounded-[1.8rem] p-12">
                <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/20">
                  <CheckCircle size={40} className="text-green-500" />
                </div>

                <div className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-600 tracking-tighter mb-2">
                  {result?.task_type === 'regression' 
                    ? (result.r2 !== undefined ? (result.r2 * 100).toFixed(1) : '0') + "% R²"
                    : (result?.accuracy !== undefined && result.accuracy !== null ? (result.accuracy * 100).toFixed(1) : '0') + "% Acc"}
                </div>

                <p className="text-gray-500 font-mono tracking-widest text-sm uppercase mb-6">Predictive Metrics</p>

                {result?.task_type === 'regression' ? (
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 text-left">
                      <p className="text-[10px] text-gray-500 font-mono uppercase mb-1">R² Score</p>
                      <p className="font-bold text-gray-200">{(result.r2 * 100).toFixed(1)}%</p>
                      <p className="text-[10px] text-gray-500 mt-2">MAE: {result.mae?.toFixed(3)}</p>
                      <p className="text-[10px] text-gray-500">RMSE: {result.rmse?.toFixed(3)}</p>
                      <p className="text-[10px] text-gray-500">MSE: {result.mse?.toFixed(3)}</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 text-left">
                      <p className="text-[10px] text-gray-500 font-mono uppercase mb-1">Training Details</p>
                      <p className="font-bold text-gray-200">Model: {result.details}</p>
                      <p className="text-[10px] text-gray-500 mt-2">Train size: {result.train_size}</p>
                      <p className="text-[10px] text-gray-500">Test size: {result.test_size}</p>
                      <p className="text-[10px] text-gray-500">Test ratio: {(result.split_ratio*100).toFixed(0)}%</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 text-left">
                      <p className="text-[10px] text-gray-500 font-mono uppercase mb-1">Accuracy</p>
                      <p className="font-bold text-gray-200">{(result.accuracy * 100).toFixed(1)}%</p>
                      <p className="text-[10px] text-gray-500 mt-2">Precision: {(result.precision*100).toFixed(1)}%</p>
                      <p className="text-[10px] text-gray-500">Recall: {(result.recall*100).toFixed(1)}%</p>
                      <p className="text-[10px] text-gray-500">F1: {(result.f1*100).toFixed(1)}%</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 text-left">
                      <p className="text-[10px] text-gray-500 font-mono uppercase mb-1">Training Details</p>
                      <p className="font-bold text-gray-200">Model: {result.details}</p>
                      <p className="text-[10px] text-gray-500 mt-2">Train size: {result.train_size}</p>
                      <p className="text-[10px] text-gray-500">Test size: {result.test_size}</p>
                      <p className="text-[10px] text-gray-500">Test ratio: {(result.split_ratio*100).toFixed(0)}%</p>
                    </div>
                  </div>
                )}


                <div className="mb-6 bg-white/5 p-4 rounded-xl border border-white/5 text-left">
                  <p className="text-[10px] text-gray-500 font-mono uppercase mb-2">Preprocessing Applied</p>
                  <p className="text-sm text-gray-300">Standardized: {result.preprocessing?.standardize?.join(", ") || 'None'}</p>
                  <p className="text-sm text-gray-300">Normalized: {result.preprocessing?.normalize?.join(", ") || 'None'}</p>
                </div>

                {result?.task_type === 'classification' && result?.confusion_matrix && (
                  <div className="mb-6">
                    <p className="text-xs text-gray-400 mb-2">Confusion Matrix</p>
                    {result.too_many_classes ? (
                      <div className="p-3 rounded-lg border border-white/5 bg-black text-sm text-gray-400">
                        <p className="mb-2">⚠️ The target has <span className="font-mono text-white">{result.labels.length}</span> classes — too many to render the full confusion matrix.</p>
                        <p className="mb-2">Suggestions: reduce the number of labels (group rare classes), use a different model (Random Forest), or inspect class distribution.</p>
                        <p className="text-xs text-gray-500">Showing a small sample (first 10 classes):</p>
                        <div className="overflow-auto rounded-lg border border-white/5 bg-black p-3 mt-3">
                          <table className="w-full text-sm table-fixed">
                            <thead>
                              <tr>
                                <th className="p-2"></th>
                                {result.labels.slice(0,10).map((l: string) => <th key={l} className="p-2 text-left">{l}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {result.confusion_matrix.slice(0,10).map((row: number[], i: number) => (
                                <tr key={i} className="border-t border-white/5">
                                  <td className="p-2 font-mono text-xs text-gray-400">{result.labels[i]}</td>
                                  {row.slice(0,10).map((v: number, j: number) => (
                                    <td key={j} className="p-2 font-bold text-gray-200">{v}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="overflow-auto rounded-lg border border-white/5 bg-black p-3">
                        <table className="w-full text-sm table-fixed">
                          <thead>
                            <tr>
                              <th className="p-2"></th>
                              {result.labels.map((l: string) => <th key={l} className="p-2 text-left">{l}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {result.confusion_matrix.map((row: number[], i: number) => (
                              <tr key={i} className="border-t border-white/5">
                                <td className="p-2 font-mono text-xs text-gray-400">{result.labels[i]}</td>
                                {row.map((v: number, j: number) => (
                                  <td key={j} className="p-2 font-bold text-gray-200">{v}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
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
