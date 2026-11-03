import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Bezirksschwimmverband Südwestsachsen",
    template: "%s | BSV-SWS",
  },
  description: "Bezirksschwimmverband Südwestsachsen e. V.",
};

/** Root layout: only <html>/<body>. Public and internal chrome live in their route groups. */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
