// app/routes/app.product.$productId.jsx
import { useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ params, request }) => {
  const { admin } = await authenticate.admin(request);
  const { productId } = params;
  const gid = `gid://shopify/Product/${productId}`;

  const response = await admin.graphql(
    `#graphql
      query getProduct($id: ID!) {
        product(id: $id) {
          id
          title
          description
          status
          featuredMedia {
            preview {
              image {
                url
                altText
              }
            }
          }
          variants(first: 10) {
            edges { node { price } }
          }
        }
      }`,
    { variables: { id: gid } }
  );

  const data = await response.json();

  if (!data?.data?.product) {
    throw new Response("Product not found", { status: 404 });
  }

  return { product: data.data.product };
};

export default function ProductDetail() {
  const { product } = useLoaderData();
  const navigate = useNavigate();

  const price = product.variants.edges[0]?.node?.price ?? "N/A";
  const imgUrl = product.featuredMedia?.preview?.image?.url ?? "";
  const imgAlt = product.featuredMedia?.preview?.image?.altText ?? product.title;

  return (
    <s-page heading={product.title}>
      {/* Back Button */}
      <s-section>
        <s-button variant="secondary" onClick={() => navigate("/app/products")}>
          ← Back to Products
        </s-button>
      </s-section>

      {/* Product Layout */}
      <s-section>
        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
          {/* Image */}
          <s-card
            style={{
              flex: "1 1 45%",
              minWidth: "300px",
              overflow: "hidden",
              borderRadius: "12px",
              transition: "transform 0.3s, box-shadow 0.3s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.03)";
              e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.1)";
            }}
          >
            {imgUrl && (
              <img
                src={imgUrl}
                alt={imgAlt}
                style={{
                  width: "100%",
                  maxHeight: "450px",
                  objectFit: "cover",
                  borderRadius: "12px",
                  marginBottom: "16px",
                  transition: "transform 0.3s",
                }}
              />
            )}
          </s-card>

          {/* Details */}
          <s-card style={{ flex: "1 1 45%", minWidth: "300px", padding: "24px" }}>
            <s-stack direction="block" gap="loose">
              <s-text variant="headingLg" style={{ fontSize: "42px", fontWeight: "bold" }}>
                {product.title}
              </s-text>
              <s-text variant="headingMd" style={{ fontSize: "20px", color: "#333" }}>
                Price: <strong>${price}</strong>
              </s-text>
              <s-text variant="headingMd" style={{ fontSize: "18px", color: "#666" }}>
                Status: {product.status}
              </s-text>
              <s-text style={{ fontSize: "16px", lineHeight: "1.5" }}>
                {product.description || "No description available."}
              </s-text>
            </s-stack>
          </s-card>
        </div>
      </s-section>
    </s-page>
  );
}

export function ErrorBoundary() {
  return (
    <s-page heading="Product Not Found">
      <s-card>
        <s-text variant="headingMd">404 - Product Not Found</s-text>
        <s-text>The product could not be loaded or doesn’t exist.</s-text>
      </s-card>
    </s-page>
  );
}

export const headers = (args) =>
  boundary?.headers?.(args) || args;
