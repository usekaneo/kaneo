import Script from "next/script";

interface StructuredDataProps {
  type?: "organization" | "software" | "article" | "faq";
  data?: {
    title?: string;
    description?: string;
    url?: string;
    datePublished?: string;
    dateModified?: string;
    questions?: Array<{
      question: string;
      answer: string;
    }>;
  };
}

export default function StructuredData({
  type = "organization",
  data,
}: StructuredDataProps) {
  const getStructuredData = () => {
    const baseData = {
      "@context": "https://schema.org",
    };

    switch (type) {
      case "organization":
        return {
          ...baseData,
          "@type": "Organization",
          name: "Kaneo",
          url: "https://kaneo.app",
          logo: "https://kaneo.app/logo.png",
          description:
            "All you need. Nothing you don't. Open source project management that works for you, not against you.",
          foundingDate: "2024",
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer service",
            url: "https://github.com/usekaneo/kaneo/issues",
          },
          sameAs: [
            "https://github.com/usekaneo/kaneo",
            "https://twitter.com/usekaneo",
            "https://discord.gg/rU4tSyhXXU",
          ],
        };

      case "software":
        return {
          ...baseData,
          "@type": "SoftwareApplication",
          name: "Kaneo",
          description:
            "Open source project management that works for you, not against you. Self-hosted, simple, and powerful.",
          url: "https://kaneo.app",
          downloadUrl: "https://github.com/usekaneo/kaneo",
          screenshot: "https://kaneo.app/screenshot.png",
          applicationCategory: "ProjectManagementApplication",
          operatingSystem: "Linux, macOS, Windows",
          softwareVersion: "latest",
          license: "https://opensource.org/licenses/MIT",
          author: {
            "@type": "Organization",
            name: "Kaneo",
            url: "https://kaneo.app",
          },
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
            description: "Free forever. All you need. Nothing you don't.",
          },
          features: [
            "Kanban boards",
            "Gantt charts",
            "Time tracking",
            "Team collaboration",
            "Issue tracking",
            "Project planning",
            "Self-hosted",
            "Docker deployment",
          ],
        };

      case "article":
        return {
          ...baseData,
          "@type": "Article",
          headline: data?.title || "Kaneo ⎯ All you need. Nothing you don't.",
          description:
            data?.description ||
            "Open source project management that works for you, not against you.",
          author: {
            "@type": "Organization",
            name: "Kaneo",
          },
          publisher: {
            "@type": "Organization",
            name: "Kaneo",
            logo: {
              "@type": "ImageObject",
              url: "https://kaneo.app/logo.png",
            },
          },
          datePublished: data?.datePublished || new Date().toISOString(),
          dateModified: data?.dateModified || new Date().toISOString(),
          mainEntityOfPage: data?.url || "https://kaneo.app",
        };

      case "faq":
        return {
          ...baseData,
          "@type": "FAQPage",
          mainEntity: data?.questions || [
            {
              "@type": "Question",
              name: "Is Kaneo really free?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes, Kaneo is completely free and open source under the MIT license. There are no user limits or hidden costs.",
              },
            },
            {
              "@type": "Question",
              name: "How does Kaneo compare to Jira?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Kaneo is an open source alternative to Jira with powerful features like issue tracking, kanban boards, and team collaboration, without the complexity or licensing costs.",
              },
            },
            {
              "@type": "Question",
              name: "Can I self-host Kaneo?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes, Kaneo is designed for self-hosting. You can deploy it with Docker in minutes and have complete control over your data.",
              },
            },
          ],
        };

      default:
        return baseData;
    }
  };

  return (
    <Script
      id={`structured-data-${type}`}
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: need to set inner html
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(getStructuredData()),
      }}
    />
  );
}
