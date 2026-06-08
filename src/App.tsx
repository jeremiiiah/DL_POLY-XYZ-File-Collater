import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  Settings, 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  Download, 
  Move, 
  Box,
  RefreshCw,
  FileText,
  Plus,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface XYZFile {
  filename: string;
  atomCount: number;
  offset: [number, number, number];
  order: number;
}

interface AppData {
  files: XYZFile[];
  box: [number, number, number];
}

export default function App() {
  const [data, setData] = useState<AppData>({ files: [], box: [150, 100, 100] });
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('My Simulation CONFIG');
  const [error, setError] = useState<string | null>(null);
  const [stepSize, setStepSize] = useState(50);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/data');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to fetch data', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleFileSelection = (filename: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(filename)) {
      newSelection.delete(filename);
    } else {
      newSelection.add(filename);
    }
    setSelectedFiles(newSelection);
  };

  const selectAll = () => {
    if (selectedFiles.size === data.files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(data.files.map(f => f.filename)));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    setError(null);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      
      const uploadPromise = new Promise((resolve, reject) => {
        reader.onload = async (event) => {
          const content = event.target?.result as string;
          try {
            const res = await fetch('/api/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename: file.name, content })
            });
            const result = await res.json();
            if (result.success) resolve(true);
            else reject(new Error(`Failed to upload ${file.name}`));
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(new Error('File reading error'));
        reader.readAsText(file);
      });

      try {
        await uploadPromise;
      } catch (err) {
        setError((err as Error).message);
      }
    }
    
    await fetchData();
    setLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleShift = async (filename: string, axis: number, value: number) => {
    // Optimistic update
    setData(prev => ({
      ...prev,
      files: prev.files.map(f => 
        f.filename === filename 
          ? { ...f, offset: f.offset.map((v, i) => i === axis ? value : v) as [number, number, number] }
          : f
      )
    }));

    try {
      await fetch('/api/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, dx: axis === 0 ? value : data.files.find(f => f.filename === filename)?.offset[0], dy: axis === 1 ? value : data.files.find(f => f.filename === filename)?.offset[1], dz: axis === 2 ? value : data.files.find(f => f.filename === filename)?.offset[2] })
      });
      // We don't strictly need to fetchData() here if optimistic update is correct, 
      // but it's good for final sync.
    } catch (err) {
      console.error(err);
      fetchData(); // Rollback on error
    }
  };

  const applyBulkShift = async (axis: number, delta: number) => {
    // Optimistic update for all selected
    setData(prev => ({
      ...prev,
      files: prev.files.map(f => 
        selectedFiles.has(f.filename)
          ? { ...f, offset: f.offset.map((v, i) => i === axis ? v + delta : v) as [number, number, number] }
          : f
      )
    }));

    // Send requests
    const promises = Array.from(selectedFiles).map(filename => {
      const file = data.files.find(f => f.filename === filename);
      if (!file) return Promise.resolve();
      
      const newOffset = [...file.offset];
      newOffset[axis] += delta;

      return fetch('/api/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, dx: newOffset[0], dy: newOffset[1], dz: newOffset[2] })
      });
    });

    try {
      await Promise.all(promises);
    } catch (err) {
      console.error(err);
      fetchData(); // Rollback
    }
  };

  const handleOrder = async (filename: string, newOrder: number) => {
    try {
      await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, order: newOrder })
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (filename: string) => {
    console.log('Deleting file:', filename);
    try {
      const response = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });
      const result = await response.json();
      console.log('Delete result:', result);
      
      // Remove from selection if it was selected
      if (selectedFiles.has(filename)) {
        const newSelection = new Set(selectedFiles);
        newSelection.delete(filename);
        setSelectedFiles(newSelection);
      }
      fetchData();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleBoxChange = async (axis: number, value: string) => {
    const newBox = [...data.box] as [number, number, number];
    // If empty, treat as 0 for the backend but allow empty string in UI
    const numVal = value === '' ? 0 : parseFloat(value);
    if (isNaN(numVal)) return;
    
    newBox[axis] = numVal;
    
    try {
      await fetch('/api/box', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x: newBox[0], y: newBox[1], z: newBox[2] })
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset everything?')) return;
    try {
      await fetch('/api/reset', { method: 'POST' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownload = () => {
    window.open(`/api/config?title=${encodeURIComponent(title)}`, '_blank');
  };

  const totalAtoms = data.files.reduce((sum, f) => sum + f.atomCount, 0);

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#1A1A1A] font-sans p-6 md:p-12">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-5xl font-serif italic mb-2 tracking-tight">XYZ Collator</h1>
            <p className="text-sm uppercase tracking-widest opacity-50 font-medium">Molecular Configuration Builder</p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleReset}
              className="p-3 rounded-full border border-black/10 hover:bg-black hover:text-white transition-colors"
              title="Reset All"
            >
              <RefreshCw size={20} />
            </button>
            <button 
              onClick={handleDownload}
              disabled={data.files.length === 0}
              className="flex items-center gap-2 bg-[#5A5A40] text-white px-6 py-3 rounded-full hover:bg-[#4A4A30] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Download size={20} />
              <span>Generate CONFIG</span>
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar: Global Settings */}
          <div className="lg:col-span-1 space-y-8">
            <section className="bg-white rounded-3xl p-8 shadow-sm border border-black/5">
              <div className="flex items-center gap-3 mb-6">
                <Move className="text-[#5A5A40]" size={24} />
                <h2 className="text-xl font-serif italic">Shift Controls</h2>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="text-xs uppercase tracking-wider opacity-50 font-bold block mb-2">Step Distance</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      value={stepSize === 0 ? '' : stepSize} 
                      placeholder="0.0"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                          setStepSize(val === '' ? 0 : parseFloat(val) || 0);
                        }
                      }}
                      onFocus={(e) => e.target.select()}
                      className="w-full bg-transparent border-b border-black/10 focus:border-[#5A5A40] outline-none py-1 font-mono"
                    />
                  </div>
                </div>

                {selectedFiles.size > 0 && (
                  <div className="pt-4 border-t border-black/5 space-y-4">
                    <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Bulk Shift ({selectedFiles.size} selected)</p>
                    <div className="grid grid-cols-3 gap-2">
                      {['X', 'Y', 'Z'].map((axis, i) => (
                        <div key={axis} className="flex flex-col gap-1">
                          <button 
                            onClick={() => applyBulkShift(i, stepSize)}
                            className="bg-[#F5F5F0] hover:bg-[#5A5A40] hover:text-white p-2 rounded-lg text-xs font-bold transition-colors"
                          >
                            +{axis}
                          </button>
                          <button 
                            onClick={() => applyBulkShift(i, -stepSize)}
                            className="bg-[#F5F5F0] hover:bg-[#5A5A40] hover:text-white p-2 rounded-lg text-xs font-bold transition-colors"
                          >
                            -{axis}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="bg-white rounded-3xl p-8 shadow-sm border border-black/5">
              <div className="flex items-center gap-3 mb-6">
                <Box className="text-[#5A5A40]" size={24} />
                <h2 className="text-xl font-serif italic">Box Dimensions</h2>
              </div>
              <div className="space-y-4">
                {['X', 'Y', 'Z'].map((label, i) => (
                  <div key={label} className="flex items-center justify-between">
                    <label className="text-xs uppercase tracking-wider opacity-50 font-bold">{label} Axis</label>
                    <input 
                      type="text" 
                      value={data.box[i] === 0 ? '' : data.box[i]} 
                      placeholder="0.0"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                          handleBoxChange(i, val);
                        }
                      }}
                      onFocus={(e) => e.target.select()}
                      className="w-24 text-right bg-transparent border-b border-black/10 focus:border-[#5A5A40] outline-none py-1 font-mono"
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white rounded-3xl p-8 shadow-sm border border-black/5">
              <div className="flex items-center gap-3 mb-6">
                <FileText className="text-[#5A5A40]" size={24} />
                <h2 className="text-xl font-serif italic">Config Metadata</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-wider opacity-50 font-bold block mb-2">Title</label>
                  <input 
                    type="text" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-transparent border-b border-black/10 focus:border-[#5A5A40] outline-none py-1"
                  />
                </div>
                <div className="pt-4 border-t border-black/5">
                  <div className="flex justify-between text-sm">
                    <span className="opacity-50">Total Atoms</span>
                    <span className="font-mono font-bold">{totalAtoms}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="opacity-50">Files Collated</span>
                    <span className="font-mono font-bold">{data.files.length}</span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Main Content: File Management */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between mb-4 px-4">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-serif italic">Molecular Files</h2>
                {data.files.length > 0 && (
                  <button 
                    onClick={selectAll}
                    className="text-[10px] uppercase tracking-widest font-bold opacity-40 hover:opacity-100 transition-opacity"
                  >
                    {selectedFiles.size === data.files.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 text-sm uppercase tracking-widest font-bold hover:text-[#5A5A40] transition-colors"
              >
                <Plus size={18} />
                <span>Add .XYZ</span>
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                multiple 
                accept=".xyz" 
                className="hidden" 
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm border border-red-100 mb-6">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {data.files.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-white/50 border-2 border-dashed border-black/5 rounded-3xl p-12 text-center"
                  >
                    <Upload className="mx-auto mb-4 opacity-20" size={48} />
                    <p className="opacity-40 italic">No files added yet. Upload .XYZ files to begin.</p>
                  </motion.div>
                ) : (
                  data.files.map((file, idx) => (
                    <motion.div 
                      key={file.filename}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`bg-white rounded-3xl p-6 shadow-sm border transition-all ${selectedFiles.has(file.filename) ? 'border-[#5A5A40] ring-1 ring-[#5A5A40]/20' : 'border-black/5'} group`}
                    >
                      <div className="flex flex-col md:flex-row gap-6">
                        {/* Selection & Order */}
                        <div className="flex items-start gap-4 flex-1">
                          <div className="pt-2">
                            <input 
                              type="checkbox" 
                              checked={selectedFiles.has(file.filename)}
                              onChange={() => toggleFileSelection(file.filename)}
                              className="w-4 h-4 rounded border-black/10 text-[#5A5A40] focus:ring-[#5A5A40]"
                            />
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <button 
                              onClick={() => handleOrder(file.filename, Math.max(1, file.order - 1))}
                              className="p-1 hover:bg-black/5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <div className="w-8 h-8 rounded-full bg-[#F5F5F0] flex items-center justify-center text-xs font-bold">
                              {file.order}
                            </div>
                            <button 
                              onClick={() => handleOrder(file.filename, file.order + 1)}
                              className="p-1 hover:bg-black/5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <ArrowDown size={14} />
                            </button>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-lg truncate max-w-[200px]">{file.filename}</h3>
                            <p className="text-xs uppercase tracking-wider opacity-40 font-bold">{file.atomCount} Atoms</p>
                          </div>
                          <button 
                            type="button"
                            onClick={() => handleDelete(file.filename)}
                            className="p-2 text-red-500/30 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                            title="Remove file"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>

                        {/* Offsets with Step Buttons */}
                        <div className="flex flex-wrap items-center gap-4">
                          {['X', 'Y', 'Z'].map((axis, i) => (
                            <div key={axis} className="flex items-center gap-2 bg-[#F5F5F0] px-3 py-2 rounded-xl">
                              <span className="text-[10px] font-bold opacity-30">{axis}</span>
                              <div className="flex items-center gap-1">
                                <button 
                                  onClick={() => handleShift(file.filename, i, file.offset[i] - stepSize)}
                                  className="p-1 hover:bg-black/10 rounded text-[10px] font-bold"
                                >
                                  -
                                </button>
                                <input 
                                  type="number" 
                                  value={file.offset[i]} 
                                  onChange={(e) => handleShift(file.filename, i, parseFloat(e.target.value) || 0)}
                                  className="w-16 bg-transparent outline-none text-sm font-mono text-right"
                                />
                                <button 
                                  onClick={() => handleShift(file.filename, i, file.offset[i] + stepSize)}
                                  className="p-1 hover:bg-black/10 rounded text-[10px] font-bold"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
      
      {loading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="animate-spin text-[#5A5A40]" size={48} />
            <p className="font-serif italic text-xl">Processing files...</p>
          </div>
        </div>
      )}
    </div>
  );
}
