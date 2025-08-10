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
            "Free open source project management software for teams. Self-hosted alternative to Jira, Asana & Monday.com.",
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
            "Free open source project management software for teams. Self-hosted alternative to Jira, Asana & Monday.com with kanban boards, time tracking, and team collaboration.",
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
            description:
              "Free forever - open source project management software",
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
          headline:
            data?.title || "Free Open Source Project Management Software",
          description:
            data?.description ||
            "Complete guide to Kaneo - the free, open source project management software",
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
                text: "Kaneo is a free, open source alternative to Jira with similar features like issue tracking, project management, and team collaboration, but without licensing costs.",
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
