import { useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";

// Local helper for JSON responses
function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return new Response(JSON.stringify(data), { ...init, headers });
}

// Loader: fetch products from Shopify Admin GraphQL API
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const query = `
    query getProducts($first: Int = 20) {
      products(first: $first) {
        edges {
          node {
            id
            title
            handle
            status
            descriptionHtml
            featuredMedia {
              preview {
                image {
                  url
                  altText
                }
              }
            }
            variants(first: 1) {
              edges {
                node {
                  id
                  price
                }
              }
            }
          }
        }
      }
    }
  `;

  const response = await admin.graphql(query);
  const result = await response.json();

  if (!result?.data?.products?.edges) {
    throw new Response("Failed to fetch products", { status: 500 });
  }

  return json(result.data.products.edges);
};

// Component: Product grid UI
export default function ProductsPage() {
  const products = useLoaderData();
  const navigate = useNavigate();

  return (
    <s-page title="Products">
      {/* Navigation */}
      <s-stack
        direction="inline"
        gap="base"
        spacing="loose"
        style={{ marginBottom: "20px" }}
      >
        <s-button onClick={() => navigate("/app")} variant="secondary">
          ← Back to Home
        </s-button>
      </s-stack>

      {/* Product Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "20px",
          padding: "20px 0",
        }}
      >
        {products.map(({ node }) => {
          const imageUrl =
            node.featuredMedia?.preview?.image?.url ||
            "https://via.placeholder.com/300";
          const altText =
            node.featuredMedia?.preview?.image?.altText || node.title;
          const price = node.variants?.edges?.[0]?.node?.price ?? "N/A";

          return (
            <s-box
              key={node.id}
              padding="base"
              borderWidth="base"
              borderRadius="large"
              background="bg-surface"
              shadow="base"
              minHeight="380px"
              style={{
                transition: "transform 0.25s ease, box-shadow 0.25s ease",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow =
                  "0 8px 18px rgba(0, 0, 0, 0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  "0 2px 6px rgba(0, 0, 0, 0.08)";
              }}
            >
              <s-stack direction="block" gap="base" alignment="center">
                <img
                  src={imageUrl}
                  alt={altText}
                  style={{
                    width: "100%",
                    height: "200px",
                    objectFit: "cover",
                    borderRadius: "8px",
                  }}
                />

                <s-text variant="headingSm" fontWeight="bold">
                  {node.title}
                </s-text>

                <s-text>Status: {node.status}</s-text>
                <s-text>Price: ${price}</s-text>

                <s-button
                  onClick={() =>
                    navigate(`/app/product/${node.id.split("/").pop()}`)
                  }
                  variant="secondary"
                  size="small"
                >
                  View Details
                </s-button>
              </s-stack>
            </s-box>
          );
        })}
      </div>
    </s-page>
  );
}
