const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "BoardBodh";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-xl text-center">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-sage" />
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-sage">
            Phase 0
          </span>
        </div>

        <h1 className="font-display text-6xl font-medium tracking-tight text-ink sm:text-7xl">
          {appName}
        </h1>

        <p className="mt-5 text-lg text-ink/70">
          Std 12 Physics progression engine. A guided year of exams, never the
          same question twice.
        </p>

        <p className="mt-8 font-devanagari text-xl text-ink/80">
          भौतिकशास्त्र
        </p>

        <div className="mt-10 inline-flex items-center gap-2 rounded-full border border-terracotta/30 bg-terracotta/5 px-4 py-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-terracotta" />
          <span className="text-sm text-terracotta">
            Scaffold running locally
          </span>
        </div>
      </div>
    </main>
  );
}
