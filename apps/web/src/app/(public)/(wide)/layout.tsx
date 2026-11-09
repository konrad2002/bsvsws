/** Full-width content pages (calendar, clubs, login, invitations). */
export default function WideLayout({ children }: { children: React.ReactNode }) {
  return <div className="page-padding">{children}</div>;
}
