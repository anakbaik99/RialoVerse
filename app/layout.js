import "./globals.css";

export const metadata = {
  title: "RialoVerse",
  description: "Swap. Play. Explore.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
