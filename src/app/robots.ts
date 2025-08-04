// src\app\robots.ts
import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/'], // Block any admin or API routes
    },
    sitemap: 'https://nzhousingstats.madebyalex.dev/sitemap.xml',
  }
}