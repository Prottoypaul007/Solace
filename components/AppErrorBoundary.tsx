import React from 'react';

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, { message: string }> {
  state = { message: '' };

  static getDerivedStateFromError(error: Error) {
    return { message: error.message || 'The app could not read its data.' };
  }

  render() {
    if (this.state.message) return (
      <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
        <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-rose-500/40 bg-slate-900 p-5">
          <h1 className="text-lg font-semibold">Solace could not open this screen</h1>
          <p role="alert" className="text-sm text-rose-200">{this.state.message}</p>
          <p className="text-sm text-slate-300">Your stored records have not been cleared. You can open Settings to export or restore a backup.</p>
          <button className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold" onClick={() => { window.location.hash = '#/settings'; window.location.reload(); }}>Open Settings</button>
        </div>
      </main>
    );
    return this.props.children;
  }
}
