// app/layout.tsx
import "./globals.css";
import { ReactNode } from "react";
import Providers from "@/components/Providers";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700 text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
