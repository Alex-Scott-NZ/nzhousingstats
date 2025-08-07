// src\app\layout.tsx
import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { getTotalsByLocationType } from "../../lib/data-collection";
import Header from "./components/Header";
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
    other: {
      "msvalidate.01": "B0757AE5EBBFAF54E821655817F59B4E",
    },
  },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏠</text></svg>",
    shortcut:
      "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏠</text></svg>",
    apple:
      "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏠</text></svg>",
  },
};

async function getHeaderData() {
  try {
    const totals = await getTotalsByLocationType("HOUSES_TO_BUY");
    return { lastUpdated: totals.lastUpdated };
  } catch (error) {
    console.error("Failed to load header data:", error);
    return { lastUpdated: new Date().toISOString() };
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerData = await getHeaderData();

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
        <div className="min-h-screen bg-[#fafafa] p-4 sm:p-6">
          <div className="w-full max-w-7xl mx-auto space-y-3 sm:space-y-5">
            <Header lastUpdated={headerData.lastUpdated} />
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
