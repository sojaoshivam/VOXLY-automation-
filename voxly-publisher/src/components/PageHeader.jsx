export default function PageHeader({ eyebrow, title, description, action }) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--voxly-muted)]">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--voxly-ink)] sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--voxly-muted)]">{description}</p>
        )}
      </div>
      {action}
    </header>
  );
}
