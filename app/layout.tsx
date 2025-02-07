// app/layout.tsx
import "./globals.css";

export const metadata = {
  title: "Kings Cup Multiplayer Game",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: "2rem", fontFamily: "sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
