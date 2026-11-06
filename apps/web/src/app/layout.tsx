import type { Metadata } from "next";
import "./globals.css";
import "@/styles/rich-content.scss";
import { NavigationProgress } from "@/components/layout/navigation-progress";

export const metadata: Metadata = {
  title: {
    default: "Bezirksschwimmverband Südwestsachsen",
    template: "%s | BSV-SWS",
  },
  description: "Bezirksschwimmverband Südwestsachsen e. V.",
};

/**
 * Root layout: only <html>/<body> and the navigation progress bar. Public and
 * internal chrome live in their route groups.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <NavigationProgress />
        {children}
      </body>
    </html>
  );
}
