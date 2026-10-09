import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Expediente Judicial Electrónico",
  description: "Plataforma privada de gestión de actuaciones y promociones procesales",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-100 text-slate-800">{children}</body>
    </html>
  );
}
