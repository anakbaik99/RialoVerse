import "./globals.css";
import { Providers } from "./providers";
import { Space_Grotesk, Anton, Orbitron } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
});

const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
});

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-orbitron",
});

export const metadata = {
  title: "RialoVerse",
  description: "Swap. Play. Explore.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${anton.variable} ${orbitron.variable} ${spaceGrotesk.className}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
