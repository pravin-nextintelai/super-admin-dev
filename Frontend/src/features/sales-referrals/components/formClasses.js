// Shared input classes (kept out of primitives.jsx so react-refresh only sees components there).
export const INPUT_CLASS =
  'w-full px-3 py-2 border rounded-lg text-sm text-slate-800 bg-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500';
export const inputClass = (hasError) => `${INPUT_CLASS} ${hasError ? 'border-red-400' : 'border-slate-300'}`;
