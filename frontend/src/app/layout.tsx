import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import QueryProvider from "@/features/pkl-activity/providers/QueryProvider";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "sampulkreativ.app",
  description: "Portal Internal Karyawan Sampul Kreativ",
  manifest: "/site.webmanifest",
  icons: {
    icon: "/favicon-32x32.png",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="sampulkreativ.app" />
        <Script id="session-isolation" strategy="beforeInteractive">
          {`
            (function() {
              if (typeof window !== 'undefined') {
                var originalGetItem = localStorage.getItem.bind(localStorage);
                var originalSetItem = localStorage.setItem.bind(localStorage);
                var originalRemoveItem = localStorage.removeItem.bind(localStorage);

                var sessionKeys = ['v2_user', 'v2_clockInDate', 'v2_clockOutDate', 'v2_clockInTime', 'v2_scanned_token'];

                localStorage.getItem = function(key) {
                  if (sessionKeys.includes(key)) {
                    return sessionStorage.getItem(key);
                  }
                  return originalGetItem(key);
                };

                localStorage.setItem = function(key, value) {
                  if (sessionKeys.includes(key)) {
                    sessionStorage.setItem(key, value);
                    return;
                  }
                  originalSetItem(key, value);
                };

                localStorage.removeItem = function(key) {
                  if (sessionKeys.includes(key)) {
                    sessionStorage.removeItem(key);
                    return;
                  }
                  originalRemoveItem(key);
                };
              }
            })();
          `}
        </Script>
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <QueryProvider>
          {children}
        </QueryProvider>
        <Script id="pwa-sw-register" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').then(
                  function(reg) {
                    console.log('ServiceWorker registration successful');
                  },
                  function(err) {
                    console.log('ServiceWorker registration failed: ', err);
                  }
                );
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}

