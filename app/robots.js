const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.andifinancial.com";

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/manage", "/manage-mobile", "/staff", "/api/"],
      },
    ],
    host: siteUrl,
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
