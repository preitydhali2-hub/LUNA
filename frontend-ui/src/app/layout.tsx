import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LUNA · NHS Clinical Reception & Telephony",
  description: "Autonomous Primary Care Clinical Triage Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#08070e] text-[#f0eef6] antialiased">
        {children}
      </body>
    </html>
  );
}