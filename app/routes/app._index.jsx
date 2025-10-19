import { useAppBridge } from "@shopify/app-bridge-react";
import { useFetcher, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

// Authenticate Shopify admin
export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

// Main index page
export default function Index() {
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const navigate = useNavigate();

  return (
    <s-page heading="Welcome to Your Shopify App">
      <s-section>
        <s-heading size="large" as="h2" spacing="loose">
          Manage Your Store Efficiently
        </s-heading>

        <s-paragraph spacing="base">
          Use the buttons below to navigate through your products or update your app settings.
        </s-paragraph>
      </s-section>

      <s-stack direction="inline" gap="base" alignment="start" spacing="loose">
        <s-button
          onClick={() => navigate("/app/products")}
          variant="primary"
          size="large"
        >
          Products
        </s-button>

        <s-button
          onClick={() => navigate("/app/settings")}
          variant="secondary"
          size="large"
        >
          Settings
        </s-button>

        <s-button
          onClick={() => navigate("/app/questionnaire")}
          variant="secondary"
          size="large"
        >
          Questionnaire
        </s-button>
      </s-stack>
    </s-page>
  );
}

// Ensure Shopify boundary headers are applied correctly
export const headers = (headersArgs) => {
  if (boundary && typeof boundary.headers === "function") {
    try {
      return boundary.headers(headersArgs);
    } catch {
      return headersArgs;
    }
  }
  return headersArgs;
};
