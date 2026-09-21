const workflow = [
  {
    step: "01",
    title: "Company setup",
    body: "Add employees, machines, and login accounts. Mark workers and supervisors once — duty and piles use that master list.",
  },
  {
    step: "02",
    title: "Open the shift",
    body: "Start today’s shift, pick running machines, and mark who is on duty. Only one open shift at a time.",
  },
  {
    step: "03",
    title: "Jobs & piles",
    body: "Create jobs with Job No (or auto Job1, Job2…), UPS, and Dabbi. Workers pile In/Out — remaining sheets stay under control.",
  },
  {
    step: "04",
    title: "Live dashboards",
    body: "See workers currently with pile IN, sheet bars by job, machine UPS charts, and yellow jobs carried from earlier shifts.",
  },
];

const features = [
  {
    title: "Shift & duty",
    body: "Open/close shifts, assign machines, and toggle workers on or off for the floor.",
  },
  {
    title: "Jobs with UPS & Dabbi",
    body: "Required UPS and Dabbi on every job. Optional Job No auto-fills as Job1, Job2…",
  },
  {
    title: "Pile In / Out",
    body: "Record sheets when work starts and finishes. Open piles show on the employee dashboard.",
  },
  {
    title: "Hard sheet limits",
    body: "Backend blocks over-allocation so a job never gets more sheets than remaining.",
  },
  {
    title: "Machine report",
    body: "Company view of jobs and workers by machine — clear production history per shift.",
  },
  {
    title: "Yellow job carry",
    body: "Unfinished jobs from earlier shifts stay visible until remaining sheets hit zero.",
  },
];

export function LandingSections() {
  return (
    <>
      <section
        id="how-it-works"
        className="border-t border-[var(--line)] bg-[var(--surface)] py-16 md:py-24"
      >
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <h2 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--ink)] md:text-4xl">
            How Evershine Trader runs the floor
          </h2>
          <p className="mt-3 max-w-2xl text-[var(--muted)]">
            One path from company setup to live pile tracking — designed for phones,
            tablets, and desktop on the production floor.
          </p>
          <ol className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {workflow.map((item) => (
              <li key={item.step}>
                <p className="font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--brand)]">
                  {item.step}
                </p>
                <h3 className="mt-2 font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                  {item.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="why" className="border-t border-[var(--line)] bg-white py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <h2 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--ink)] md:text-4xl">
            Built for your daily floor work
          </h2>
          <p className="mt-3 max-w-2xl text-[var(--muted)]">
            Everything your company and floor operators use today — shifts, jobs, sheets,
            and reports — in one place.
          </p>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((item) => (
              <article key={item.title} className="border-t-2 border-[var(--brand)] pt-4">
                <h3 className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--line)] bg-[var(--brand-dark)] py-16 md:py-20">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-white md:text-3xl">
              Ready for the next shift?
            </h2>
            <p className="mt-2 max-w-md text-sm text-white/70">
              Sign in with your company or floor account to open a shift and start tracking.
            </p>
          </div>
          <a
            href="/login"
            className="inline-flex items-center justify-center rounded-lg bg-[#c4a035] px-6 py-3 text-sm font-semibold text-[#14201b] transition hover:bg-[#d4b045]"
          >
            Go to login
          </a>
        </div>
      </section>

      <footer className="border-t border-[var(--line)] bg-white py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 text-sm text-[var(--muted)] md:flex-row md:items-center md:justify-between md:px-6">
          <p className="font-[family-name:var(--font-display)] text-base text-[var(--ink)]">
            Evershine <span className="text-[var(--brand)]">Trader</span>
          </p>
          <p>Shift · Jobs · Piles · Machine reports</p>
        </div>
      </footer>
    </>
  );
}
