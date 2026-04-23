
import { useState, useRef, useCallback } from 'react';
import { X, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import { parseCSVRow, scoreRooftop } from '../lib/ragLogic';
import type { RooftopScored } from '../lib/ragLogic';

export const CSV_STORAGE_KEY = 'vini_rag_csv';

interface Props {
  onImport: (rooftops: RooftopScored[], timestamp: string) => void;
  onClose: () => void;
}

type ImportState = 'idle' | 'dragover' | 'parsing' | 'success' | 'error';

const REQUIRED_COLUMNS = [
  'rooftop_name',
  'total_leads',
  'total_leads_interacted_with_vini',
  'appointment_booking_rate',
];

export default function ImportModal({ onImport, onClose }: Props) {
  const [state, setState] = useState<ImportState>('idle');
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith('.csv')) {
        setState('error');
        setMessage('Please upload a .csv file.');
        return;
      }
      setState('parsing');
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const headers = results.meta.fields ?? [];
          const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
          if (missing.length > 0) {
            setState('error');
            setMessage(`Missing columns: ${missing.join(', ')}`);
            return;
          }

          const rows = results.data as Record<string, string>[];
          let skipped = 0;
          const scored: RooftopScored[] = [];
          for (const row of rows) {
            const parsed = parseCSVRow(row);
            if (!parsed) { skipped++; continue; }
            scored.push(scoreRooftop(parsed));
          }

          if (scored.length === 0) {
            setState('error');
            setMessage('No valid accounts found in this file.');
            return;
          }

          const timestamp = new Date().toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit',
          });

          setState('success');
          setMessage(`${scored.length} accounts loaded, ${skipped} skipped (test/blank).`);

          // Store raw CSV for later re-use
          try {
            const raw = Papa.unparse(rows);
            localStorage.setItem(CSV_STORAGE_KEY, raw);
          } catch {}

          setTimeout(() => {
            onImport(scored, timestamp);
            onClose();
          }, 1200);
        },
        error: () => {
          setState('error');
          setMessage('Failed to parse CSV. Please check the file format.');
        },
      });
    },
    [onImport, onClose]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setState('idle');
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Import CSV</h2>
            <p className="text-xs text-slate-400 mt-0.5">Same column structure as the Excel export</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Drop zone */}
        <div className="p-6">
          {state !== 'success' && state !== 'error' ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setState('dragover'); }}
              onDragLeave={() => setState('idle')}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
                state === 'dragover'
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className={`p-3 rounded-full ${state === 'dragover' ? 'bg-blue-100' : 'bg-slate-100'}`}>
                <Upload className={`w-5 h-5 ${state === 'dragover' ? 'text-blue-600' : 'text-slate-400'}`} />
              </div>
              {state === 'parsing' ? (
                <p className="text-sm text-slate-600 font-medium">Parsing…</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-700">
                    {state === 'dragover' ? 'Drop it here' : 'Drag & drop or click to browse'}
                  </p>
                  <p className="text-xs text-slate-400">.csv files only</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          ) : (
            <div
              className={`rounded-xl p-6 flex flex-col items-center gap-3 ${
                state === 'success' ? 'bg-green-50' : 'bg-red-50'
              }`}
            >
              {state === 'success' ? (
                <CheckCircle className="w-8 h-8 text-green-600" />
              ) : (
                <AlertCircle className="w-8 h-8 text-red-500" />
              )}
              <p className={`text-sm font-medium text-center ${state === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                {message}
              </p>
              {state === 'error' && (
                <button
                  onClick={() => { setState('idle'); setMessage(''); }}
                  className="text-xs text-slate-500 underline cursor-pointer"
                >
                  Try again
                </button>
              )}
            </div>
          )}
        </div>

        {/* Expected columns */}
        <div className="px-6 pb-6">
          <p className="text-xs font-medium text-slate-500 mb-2">Expected columns</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              'team_id', 'enterprise_name', 'rooftop_name', 'Agent Type', 'total_leads',
              'total_leads_interacted_with_vini', 'total_appointments',
              'appointment_booking_rate', 'avg_score_percentage',
            ].map((col) => (
              <span key={col} className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                {col}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
