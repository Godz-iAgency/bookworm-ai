import { PLANS } from "@/lib/plans";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * Structured data: the same facts the pages already state, in the form search
 * engines read. Nothing here may claim more than the visible pages do (no
 * ratings, no reviews), because Google ignores structured data that disagrees
 * with what a visitor can see.
 */
function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // "<" is escaped so no value can ever close the script tag early.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

/** Who runs the site and what it is called. On every page. */
export function SiteJsonLd() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: SITE_NAME,
          legalName: "GODZ-i LLC",
          url: SITE_URL,
          logo: `${SITE_URL}/brand/mark.png`,
          contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: SUPPORT_EMAIL },
        }}
      />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: SITE_URL }} />
    </>
  );
}

/** The product and its three monthly plans, built from lib/plans.ts so the prices cannot go stale. Home page only. */
export function AppJsonLd() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        url: SITE_URL,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        description: SITE_DESCRIPTION,
        offers: PLANS.map((plan) => ({
          "@type": "Offer",
          name: plan.name,
          description: plan.tagline,
          price: plan.price.replace("$", ""),
          priceCurrency: "USD",
          url: `${SITE_URL}/pricing`,
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: plan.price.replace("$", ""),
            priceCurrency: "USD",
            unitCode: "MON",
          },
        })),
      }}
    />
  );
}
