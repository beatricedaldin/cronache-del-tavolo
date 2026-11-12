import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Nunito_Sans, Spectral_SC } from "next/font/google";
import "./globals.css";

const display = Spectral_SC({ variable: "--font-spectral-sc", subsets: ["latin"], weight: ["500", "700"] });
const sans = Nunito_Sans({ variable: "--font-nunito-sans", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"], weight: ["500"] });

export const metadata: Metadata = {
  title: { default: "Cronache del Tavolo", template: "%s · Cronache del Tavolo" },
  description: "Schede, diario e memoria condivisa della vostra campagna di Fabula Ultima.",
  applicationName: "Cronache del Tavolo",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef2f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1426" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans text-[15px] leading-relaxed">{children}</body>
    </html>
  );
}
