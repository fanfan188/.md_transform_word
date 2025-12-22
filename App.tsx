
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ProcessingLog, FileData, ConversionStatus } from './types';
import { convertToDocx } from './services/docxConverter';
import { polishMarkdown } from './services/aiService';
import { 
  FileText, 
  Wand2, 
  Trash2, 
  CheckCircle2, 
  Download, 
  ImageIcon, 
  Loader2, 
  Terminal, 
  AlertCircle 
} from 'lucide-react';

const App: React.FC = () => {
  const [mdFile, setMdFile] = useState<FileData | null>(null);
  const [images, setImages] = useState<Map<string, FileData>>(new Map());
  const [logs, setLogs] = useState<ProcessingLog[]>([]);
  const [status, setStatus] = useState<ConversionStatus>(ConversionStatus.IDLE);
  const [isAiEnabled, setIsAiEnabled] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((message: string, level: ProcessingLog['level'] = 'info') => {
    setLogs(prev => [
      ...prev, 
      { id: Math.random().toString(36).substr(2, 9), timestamp: new Date(), level, message }
    ]);
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleMdUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setMdFile({
        file,
        content: event.target?.result as string
      });
      addLog(`Markdown file loaded: ${file.name}`, 'success');
    };
    reader.readAsText(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Fix: Explicitly type the files array to avoid 'unknown' errors when iterating FileList
    (Array.from(files) as File[]).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImages(prev => {
          const next = new Map(prev);
          next.set(file.name, {
            file,
            arrayBuffer: event.target?.result as ArrayBuffer
          });
          return next;
        });
        addLog(`Image registered: ${file.name}`, 'info');
      };
      // Fix: Ensure file is passed as a recognized Blob type
      reader.readAsArrayBuffer(file);
    });
  };

  const startConversion = async () => {
    if (!mdFile?.content) {
      addLog("No Markdown content to convert!", "error");
      return;
    }

    setStatus(ConversionStatus.READING);
    addLog("Starting conversion workflow...", "info");

    try {
      let content = mdFile.content;

      if (isAiEnabled) {
        setStatus(ConversionStatus.PARSING);
        addLog("AI Polishing enabled. Analyzing content...", "info");
        content = await polishMarkdown(content);
        addLog("AI Polishing complete.", "success");
      }

      setStatus(ConversionStatus.GENERATING);
      const imgBuffers = new Map<string, ArrayBuffer>();
      images.forEach((val, key) => {
        if (val.arrayBuffer) imgBuffers.set(key, val.arrayBuffer);
      });

      addLog("Generating Word Document...", "info");
      const blob = await convertToDocx(content, imgBuffers, (msg, lvl) => addLog(msg, lvl));
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${mdFile.file.name.replace('.md', '').replace('.markdown', '').replace('.txt', '')}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setStatus(ConversionStatus.COMPLETED);
      addLog("Conversion successful! Document downloaded.", "success");
    } catch (error) {
      console.error(error);
      setStatus(ConversionStatus.ERROR);
      addLog(`Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`, "error");
    }
  };

  const reset = () => {
    setMdFile(null);
    setImages(new Map());
    setLogs([]);
    setStatus(ConversionStatus.IDLE);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-8 h-8 text-blue-600" />
            MD2Word <span className="text-blue-600">Pro</span>
          </h1>
          <p className="text-slate-500 mt-1">Convert Markdown to high-quality Word documents with automatic image embedding.</p>
        </div>
        <div className="flex items-center gap-2">
           <button 
             onClick={() => setIsAiEnabled(!isAiEnabled)}
             className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${
               isAiEnabled 
               ? 'bg-purple-100 border-purple-300 text-purple-700 shadow-sm' 
               : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
             }`}
           >
             <Wand2 className={`w-4 h-4 ${isAiEnabled ? 'animate-pulse' : ''}`} />
             AI Polishing
           </button>
           <button 
             onClick={reset}
             className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
             title="Reset all"
           >
             <Trash2 className="w-5 h-5" />
           </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Uploads & Config */}
        <div className="lg:col-span-7 space-y-6">
          {/* MD Upload */}
          <div className="glass border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              Markdown File
            </h2>
            <div className="relative group">
              <input 
                type="file" 
                accept=".md,.markdown,.txt" 
                onChange={handleMdUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                mdFile ? 'border-blue-200 bg-blue-50/50' : 'border-slate-200 group-hover:border-blue-300 group-hover:bg-slate-50'
              }`}>
                {mdFile ? (
                  <div className="flex flex-col items-center">
                    <CheckCircle2 className="w-10 h-10 text-blue-500 mb-2" />
                    <p className="font-medium text-slate-800">{mdFile.file.name}</p>
                    <p className="text-sm text-slate-500">{(mdFile.file.size / 1024).toFixed(1)} KB • Ready</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-slate-400">
                    <Download className="w-10 h-10 mb-2" />
                    <p className="font-medium text-slate-600">Click or drag MD file</p>
                    <p className="text-sm">Standard Markdown supported</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Image Upload */}
          <div className="glass border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-emerald-500" />
                Image Assets
              </h2>
              <span className="text-xs font-bold px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                {images.size} Files
              </span>
            </div>
            <div className="relative group mb-4">
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                onChange={handleImageUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center group-hover:border-emerald-300 group-hover:bg-slate-50 transition-all">
                <p className="text-sm text-slate-500">Add local images referenced in your MD</p>
                <p className="text-xs text-slate-400 mt-1">PNG, JPG, SVG, GIF supported</p>
              </div>
            </div>

            {images.size > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                {/* Fix: Explicitly type the values iteration to ensure 'img' is typed as FileData instead of unknown */}
                {(Array.from(images.values()) as FileData[]).map((img, idx) => (
                  <div key={idx} className="aspect-square bg-slate-100 rounded-lg overflow-hidden border border-slate-200 group relative">
                    <img 
                      src={URL.createObjectURL(img.file)} 
                      alt={img.file.name} 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1">
                      <p className="text-[8px] text-white break-all text-center leading-tight">{img.file.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={startConversion}
            disabled={!mdFile || status === ConversionStatus.GENERATING || status === ConversionStatus.PARSING}
            className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-3 transition-all ${
              !mdFile || status === ConversionStatus.GENERATING || status === ConversionStatus.PARSING
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 hover:-translate-y-0.5'
            }`}
          >
            {status === ConversionStatus.GENERATING || status === ConversionStatus.PARSING ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Download className="w-6 h-6" />
            )}
            {status === ConversionStatus.GENERATING ? "Processing..." : status === ConversionStatus.PARSING ? "AI Thinking..." : "Generate Word Document"}
          </button>
        </div>

        {/* Right Column: Terminal Logs */}
        <div className="lg:col-span-5 h-full">
          <div className="bg-slate-900 rounded-2xl p-4 shadow-2xl flex flex-col h-[600px] border border-slate-800">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
              <Terminal className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">Real-time Processing Logs</span>
              <div className="flex gap-1.5 ml-auto">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50"></div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-700 font-mono text-sm opacity-50">
                   <p>&gt; Waiting for input...</p>
                   <p className="mt-2 text-xs">Upload MD file to begin</p>
                </div>
              ) : (
                logs.map(log => (
                  <div key={log.id} className="font-mono text-[13px] flex gap-2">
                    <span className="text-slate-600 shrink-0">[{log.timestamp.toLocaleTimeString([], { hour12: false })}]</span>
                    <span className={`
                      ${log.level === 'info' ? 'text-blue-400' : ''}
                      ${log.level === 'success' ? 'text-emerald-400' : ''}
                      ${log.level === 'warning' ? 'text-amber-400' : ''}
                      ${log.level === 'error' ? 'text-red-400' : ''}
                    `}>
                      {log.level === 'info' && '➜'}
                      {log.level === 'success' && '✓'}
                      {log.level === 'warning' && '⚠'}
                      {log.level === 'error' && '✖'}
                    </span>
                    <span className="text-slate-300 break-words">{log.message}</span>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>

            {status !== ConversionStatus.IDLE && (
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Status:</span>
                  <span className={`uppercase font-bold ${
                    status === ConversionStatus.COMPLETED ? 'text-emerald-500' : 
                    status === ConversionStatus.ERROR ? 'text-red-500' : 'text-blue-400'
                  }`}>
                    {status}
                  </span>
                </div>
                {status !== ConversionStatus.COMPLETED && status !== ConversionStatus.ERROR && (
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce"></div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="mt-12 text-center text-slate-400 text-sm border-t border-slate-200 pt-8 pb-4">
        <p>© 2024 MD2Word Pro. Built for seamless cross-platform documentation.</p>
        <div className="flex justify-center gap-4 mt-2">
          <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Standard DOCX</span>
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Image Embedding</span>
          <span className="flex items-center gap-1"><Wand2 className="w-3 h-3" /> AI Enhancement</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
