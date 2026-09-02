import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "RialoVerse",
  description: "Swap. Play. Explore.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
