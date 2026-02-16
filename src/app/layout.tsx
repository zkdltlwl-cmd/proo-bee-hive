import type { Metadata } from "next";
import { Varela_Round } from "next/font/google"; // Import Varela Round font
import "./globals.css";

// Configure Varela Round font
const varelaRound = Varela_Round({
  weight: "400", // Varela Round only has 400 weight
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Proo bee - Prove Your Instinct",
  description: "Don't just buzz, Prove it!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${varelaRound.className} antialiased bg-[#f8f9fa]`} // Apply font class and background color
      >
        {children}
      </body>
    </html>
  );
}
