import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";

// Loader: authenticate admin and pass API key to client
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    shop: session.shop,
  };
};

// Main app layout
export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Home</s-link>
        <s-link href="/app/products">Products</s-link>
        <s-link href="/app/settings">Settings</s-link>
        <s-link href="/app/questionnaire">Questionnaire</s-link>
        <s-link href="/app/form-builder">Form Builder</s-link>
        
      </s-app-nav>

      {/* Outlet for nested routes */}
      <Outlet />
    </AppProvider>
  );
}

// Error boundary required by Shopify’s boundary system
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

// Ensure proper Shopify response headers
export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
