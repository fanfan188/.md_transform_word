
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ProcessingLog, FileData, ConversionStatus, ConversionMode } from './types';
import { convertToDocx } from './services/docxConverter';
import { convertDocxToMd } from './services/mdConverter';
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
  AlertCircle,
  ArrowLeftRight,
  FileCode,
  Copy,
  Check,
  FolderOpen,
  Files
} from 'lucide-react';

const App: React.FC = () => {
  const [mode, setMode] = useState<ConversionMode>(ConversionMode.MD_TO_DOCX);
  const [sourceFile, setSourceFile] = useState<FileData | null>(null);
  const [images, setImages] = useState<Map<string, FileData>>(new Map());
  const [logs, setLogs] = useState<ProcessingLog[]>([]);
  const [status, setStatus] = useState<ConversionStatus>(ConversionStatus.IDLE);
  const [isAiEnabled, setIsAiEnabled] = useState(false);
  const [lastOutput, setLastOutput] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (mode === ConversionMode.MD_TO_DOCX) {
        setSourceFile({ file, content: result as string });
      } else {
        setSourceFile({ file, arrayBuffer: result as ArrayBuffer });
      }
      addLog(`${file.name} loaded. Size: ${(file.size / 1024).toFixed(1)} KB`, 'success');
    };

    if (mode === ConversionMode.MD_TO_DOCX) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileList = Array.from(files) as any[];
    let count = 0;

    fileList.forEach(file => {
      // If it's a folder upload, webkitRelativePath contains the path structure
      // We prioritize the relative path to match Markdown references like ![](images/fig1.png)
      const pathKey = file.webkitRelativePath || file.name;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        setImages(prev => {
          const next = new Map(prev);
          next.set(pathKey, {
            file,
            arrayBuffer: event.target?.result as ArrayBuffer
          });
          return next;
        });
        count++;
        if (count === fileList.length) {
          addLog(`Successfully processed ${count} assets from the selected location.`, 'success');
        }
      };
      reader.readAsArrayBuffer(file);
    });
    
    addLog(`Scanning ${fileList.length} files...`, 'info');
  };

  const startConversion = async () => {
    if (!sourceFile) {
      addLog("Source file missing.", "error");
      return;
    }

    setLastOutput(null);
    setStatus(ConversionStatus.READING);
    addLog(`Initiating ${mode === ConversionMode.MD_TO_DOCX ? 'MD to Word' : 'Word to MD'} pipeline...`, "info");

    try {
      if (mode === ConversionMode.MD_TO_DOCX) {
        let content = sourceFile.content || "";
        if (isAiEnabled) {
          setStatus(ConversionStatus.PARSING);
          addLog("AI Polishing enabled. Thinking...", "info");
          content = await polishMarkdown(content);
        }

        setStatus(ConversionStatus.GENERATING);
        const imgBuffers = new Map<string, ArrayBuffer>();
        images.forEach((val, key) => { if (val.arrayBuffer) imgBuffers.set(key, val.arrayBuffer); });
        
        const blob = await convertToDocx(content, imgBuffers, (msg, lvl) => addLog(msg, lvl));
        downloadFile(blob, `${sourceFile.file.name.split('.')[0]}.docx`);
      } else {
        if (!sourceFile.arrayBuffer) throw new Error("File buffer missing.");
        
        setStatus(ConversionStatus.GENERATING);
        let markdown = await convertDocxToMd(sourceFile.arrayBuffer, (msg, lvl) => addLog(msg, lvl));

        if (isAiEnabled) {
          setStatus(ConversionStatus.PARSING);
          addLog("AI Enhancing generated Markdown...", "info");
          markdown = await polishMarkdown(markdown);
        }

        setLastOutput(markdown);
        const blob = new Blob([markdown], { type: 'text/markdown' });
        downloadFile(blob, `${sourceFile.file.name.split('.')[0]}.md`);
      }

      setStatus(ConversionStatus.COMPLETED);
      addLog("Success: Output generated and downloaded.", "success");
    } catch (error) {
      console.error(error);
      setStatus(ConversionStatus.ERROR);
      addLog(`Failure: ${error instanceof Error ? error.message : 'Unknown error'}`, "error");
    }
  };

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = () => {
    if (lastOutput) {
      navigator.clipboard.writeText(lastOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      addLog("Markdown copied to clipboard.", "success");
    }
  };

  const toggleMode = () => {
    setMode(prev => prev === ConversionMode.MD_TO_DOCX ? ConversionMode.DOCX_TO_MD : ConversionMode.MD_TO_DOCX);
    reset();
  };

  const reset = () => {
    setSourceFile(null);
    setImages(new Map());
    setLogs([]);
    setLastOutput(null);
    setStatus(ConversionStatus.IDLE);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileCode className="w-8 h-8 text-blue-600" />
            MD2Word <span className="text-blue-600">Pro</span>
          </h1>
          <p className="text-slate-500 mt-1">Smart two-way converter with high-fidelity formatting.</p>
        </div>
        <div className="flex items-center gap-3">
           <button 
             onClick={toggleMode}
             className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-full font-medium transition-all shadow-sm"
           >
             <ArrowLeftRight className="w-4 h-4" />
             {mode === ConversionMode.MD_TO_DOCX ? "Switch to Word → MD" : "Switch to MD → Word"}
           </button>
           <button 
             onClick={() => setIsAiEnabled(!isAiEnabled)}
             className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${
               isAiEnabled ? 'bg-purple-100 border-purple-300 text-purple-700 shadow-sm' : 'bg-white border-slate-200 text-slate-600'
             }`}
           >
             <Wand2 className={`w-4 h-4 ${isAiEnabled ? 'animate-pulse' : ''}`} />
             AI Polishing
           </button>
           <button onClick={reset} className="p-2 text-slate-400 hover:text-red-500 rounded-lg"><Trash2 className="w-5 h-5" /></button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <div className="glass border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              {mode === ConversionMode.MD_TO_DOCX ? <FileText className="w-5 h-5 text-blue-500" /> : <FileCode className="w-5 h-5 text-emerald-500" />}
              {mode === ConversionMode.MD_TO_DOCX ? "Source Markdown" : "Source Word (.docx)"}
            </h2>
            <div className="relative group">
              <input 
                type="file" 
                accept={mode === ConversionMode.MD_TO_DOCX ? ".md,.markdown,.txt" : ".docx"} 
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                sourceFile ? 'border-blue-200 bg-blue-50/50' : 'border-slate-200 group-hover:border-blue-300'
              }`}>
                {sourceFile ? (
                  <div className="flex flex-col items-center">
                    <CheckCircle2 className="w-10 h-10 text-blue-500 mb-2" />
                    <p className="font-medium text-slate-800">{sourceFile.file.name}</p>
                    <p className="text-xs text-slate-400">File attached and ready</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-slate-400">
                    <Download className="w-10 h-10 mb-2" />
                    <p className="font-medium">Upload {mode === ConversionMode.MD_TO_DOCX ? "Markdown" : "Word document"}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {mode === ConversionMode.MD_TO_DOCX && (
            <div className="glass border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-emerald-500" />
                  Asset Library
                </h2>
                <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                  {images.size} Loaded
                </span>
              </div>
              
              <div className="flex gap-3 mb-4">
                <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 text-emerald-700 rounded-xl cursor-pointer hover:bg-emerald-100 transition-colors border border-emerald-100 font-medium text-sm">
                  <Files className="w-4 h-4" />
                  Select Files
                  <input type="file" multiple accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
                <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 text-blue-700 rounded-xl cursor-pointer hover:bg-blue-100 transition-colors border border-blue-100 font-medium text-sm">
                  <FolderOpen className="w-4 h-4" />
                  Upload Folder
                  <input 
                    type="file" 
                    webkitdirectory="" 
                    directory="" 
                    multiple 
                    onChange={handleImageUpload} 
                    className="hidden" 
                  />
                </label>
              </div>

              {images.size > 0 && (
                <div className="grid grid-cols-6 gap-2 max-h-32 overflow-y-auto p-1 custom-scrollbar">
                  {(Array.from(images.values()) as FileData[]).map((img, idx) => (
                    <div key={idx} title={img.file.name} className="aspect-square bg-slate-100 rounded-lg border overflow-hidden">
                      <img src={URL.createObjectURL(img.file)} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={startConversion}
            disabled={!sourceFile || status === ConversionStatus.GENERATING}
            className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${
              !sourceFile || status === ConversionStatus.GENERATING 
              ? 'bg-slate-200 text-slate-400 shadow-none' 
              : 'bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-xl hover:-translate-y-0.5'
            }`}
          >
            {status === ConversionStatus.GENERATING ? <Loader2 className="w-6 h-6 animate-spin" /> : <Download className="w-6 h-6" />}
            {mode === ConversionMode.MD_TO_DOCX ? "Convert to Word" : "Convert to Markdown"}
          </button>
        </div>

        <div className="lg:col-span-5">
          <div className="bg-slate-900 rounded-2xl p-4 shadow-2xl flex flex-col h-[520px] border border-slate-800">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-mono text-slate-400">OUTPUT TERMINAL</span>
              </div>
              {lastOutput && (
                <button 
                  onClick={copyToClipboard}
                  className="flex items-center gap-1.5 text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? "COPIED" : "COPY MD"}
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-30 text-slate-500 font-mono text-xs italic">
                  <span>> pipeline_idle</span>
                  <span>> waiting_for_input</span>
                </div>
              ) : (
                logs.map(log => (
                  <div key={log.id} className="font-mono text-[11px] flex gap-2">
                    <span className="text-slate-700 shrink-0">{log.timestamp.toLocaleTimeString([], { hour12: false })}</span>
                    <span className={log.level === 'error' ? 'text-red-400' : log.level === 'success' ? 'text-emerald-400' : 'text-blue-500'}>
                      [{log.level.toUpperCase()}] {log.message}
                    </span>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
