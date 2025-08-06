// src\app\layout.tsx
import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://nzhousingstats.madebyalex.dev"),
  title: {
    template: "%s | Property Listings Tracker",
    default: "Property Listings Tracker - New Zealand Real Estate Market Data",
  },
  description:
    "Real-time property market data and trends across New Zealand regions, districts, and suburbs. Track house listings, market changes, and property trends with interactive charts and analytics.",
  keywords: [
    "New Zealand property",
    "real estate market",
    "property listings",
    "house prices",
    "market trends",
    "property data",
    "Auckland property",
    "Wellington property",
    "Christchurch property",
    "property analytics",
    "real estate trends",
  ],
  authors: [{ name: "Property Listings Tracker" }],
  creator: "Property Listings Tracker",
  publisher: "Property Listings Tracker",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "unXZvzIsQ_cdAU8xQjcImiquCTXwd6m_MNjdA6CnotM",
  },
  // ✅ Remove openGraph and twitter - they get overridden anyway
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-NZ">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#ffffff" />
        <link rel="canonical" href="https://nzhousingstats.madebyalex.dev" />

        {/* Google Analytics */}
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-KBLWEVBZDJ"
        ></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-KBLWEVBZDJ');
            `,
          }}
        />

        <script
          type="text/javascript"
          dangerouslySetInnerHTML={{
            __html: `
              (function(c,l,a,r,i,t,y){
                  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "spdhy52f74");
            `,
          }}
        />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Property Listings Tracker",
              url: "https://nzhousingstats.madebyalex.dev",
              description:
                "Real-time property market data and trends across New Zealand",
              sameAs: [],
            }),
          }}
        />
      </head>
      <body
        className={`${spaceGrotesk.variable} ${spaceGrotesk.className} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
