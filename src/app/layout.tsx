import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Z-Health AI",
  description:
    "AI-powered management dashboard for Z-Health Education WordPress site",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('zhealth-theme');
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
