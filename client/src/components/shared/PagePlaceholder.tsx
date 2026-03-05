type PagePlaceholderProps = {
  title: string;
  description?: string;
};

export default function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-2xl font-bold mb-2">{title}</h2>
      <p className="text-slate-600">{description ?? "Placeholder page for milestone 01 bootstrap."}</p>
    </section>
  );
}
