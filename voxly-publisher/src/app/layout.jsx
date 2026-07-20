import "./globals.css";
import { Inter } from "next/font/google";
import AppShell from "@/components/AppShell";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Voxly Publisher",
  description: "Publish and schedule your Voxly videos to YouTube & Instagram.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark">
      <body className={`${inter.className} min-h-screen antialiased`}>{children}</body>
    </html>
  );
}
