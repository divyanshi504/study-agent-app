export default function NavBar() {
  return (
    <header className="border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-300/80">
            Study Agent
          </p>
        </div>
        <nav className="flex items-center gap-3 text-sm text-slate-300">
          <a
            href="/"
            className="rounded-full px-3 py-2 transition hover:bg-slate-800 hover:text-white"
          >
            Chat
          </a>
          <a
            href="/dashboard"
            className="rounded-full px-3 py-2 transition hover:bg-slate-800 hover:text-white"
          >
            Dashboard
          </a>
        </nav>
      </div>
    </header>
  );
}
