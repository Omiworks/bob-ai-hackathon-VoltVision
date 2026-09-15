export default function PageHeader({ title, subtitle, right }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-app-text">{title}</h1>
        {subtitle && <p className="mt-0.5 max-w-3xl text-[13px] text-app-muted">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}