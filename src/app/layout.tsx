import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DEFAULT_SITE_URL = "https://gpulso.com.br";

/*
 * Nunca deixa um NEXT_PUBLIC_SITE_URL malformado (ex.: sem
 * "https://") derrubar o layout raiz — cai no domínio padrão.
 */
function resolveMetadataBase(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  for (const candidate of [raw, DEFAULT_SITE_URL]) {
    if (!candidate) continue;
    try {
      return new URL(candidate);
    } catch {
      // tenta o próximo
    }
  }

  return new URL(DEFAULT_SITE_URL);
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: {
    default: "Grupo Pulso — Sistema de Gestão",
    template: "%s · Grupo Pulso",
  },
  description:
    "Sistema de gestão do Grupo Pulso — contratos, financeiro, edições e comissões.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
