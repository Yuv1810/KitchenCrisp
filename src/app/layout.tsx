import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Kitchen Crisp — The everyday pantry", description: "Premixes and ready-to-eat food. Shop cookies, food platters, premixes and baked treats from Kitchen Crisp, with cash on delivery." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
