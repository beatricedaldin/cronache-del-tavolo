import type { Metadata, Viewport } from "next";
import { Cinzel, JetBrains_Mono, Nunito_Sans } from "next/font/google";
import "./globals.css";
import { ServiceWorker } from "@/components/pwa";

const display = Cinzel({ variable: "--font-cinzel", subsets: ["latin"], weight: ["500", "700"] });
const sans = Nunito_Sans({ variable: "--font-nunito-sans", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"], weight: ["500"] });

export const metadata: Metadata = {
  title: { default: "Cronache del Tavolo", template: "%s · Cronache del Tavolo" },
  description: "Schede, diario e memoria condivisa della vostra campagna di Fabula Ultima.",
  applicationName: "Cronache del Tavolo",
  // iPhone: aperta dalla schermata Home si comporta come un'app (senza barre di Safari).
  appleWebApp: { capable: true, title: "Cronache", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/icons/apple-touch-icon.png", sizes: "180x180" },
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3ecdc" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0e1d" },
  ],
  // Su iPhone con la tacca il contenuto usa tutto lo schermo; i margini li gestisce il CSS.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans text-[15px] leading-relaxed">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
