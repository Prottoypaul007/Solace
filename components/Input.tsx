import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className = '',
  ...props
}) => {
  return (
    <div className="flex flex-col space-y-1 w-full">
      <label className="text-xs font-semibold text-slate-200 mb-1 pl-1">
        {label}
      </label>
      <input
        className={`flex h-11 w-full rounded-xl border bg-slate-900/70 border-slate-700 px-3 text-sm text-slate-50 shadow-inner shadow-black/30 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 ${
          error ? 'border-rose-500 focus-visible:ring-rose-500' : ''
        } ${className}`}
        {...props}
      />
      {error && (
        <span className="text-[11px] text-rose-400 mt-0.5 pl-1">{error}</span>
      )}
    </div>
  );
};
