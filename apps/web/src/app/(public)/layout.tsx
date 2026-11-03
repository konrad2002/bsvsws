/** Public website layout (header navigation per spec §9.1). Placeholder until design is supplied. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b px-4 py-3">
        <span className="font-semibold">Bezirksschwimmverband Südwestsachsen</span>
      </header>
      <main className="flex-1 px-4 py-6">{children}</main>
    </>
  );
}
