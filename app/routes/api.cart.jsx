import { json } from "../utils/response";
import { authenticate } from "../shopify.server";

export async function action({ request }) {
  try {
    const { admin, session } = await authenticate.admin(request);
    const shop = session?.shop;

    if (!shop) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action: actionType, data } = body;

    switch (actionType) {
      case "create_variant":
        return await createProductVariant(admin, data);
      
      case "find_or_create_variant":
        return await findOrCreateVariant(admin, data);
      
      case "create_draft_order":
        return await createDraftOrder(admin, data);
      
      case "get_products":
        return await getProducts(admin);
      
      case "get_product_variants":
        return await getProductVariants(admin, data.productId);
      
      default:
        return json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Cart API error:", error);
    return json({ error: error.message }, { status: 500 });
  }
}

//=============product variant operations=================
async function createProductVariant(admin, data) {
  const {
    productId,
    title,
    price,
    sku,
    inventoryPolicy,
    options,
    metafields
  } = data;

  try {
    const response = await admin.graphql(`
      mutation createProductVariant($input: ProductVariantInput!) {
        productVariantCreate(input: $input) {
          productVariant {
            id
            title
            price
            sku
            inventoryItem {
              id
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: {
        input: {
          productId: productId,
          title: title,
          price: price.toString(),
          sku: sku,
          inventoryPolicy: inventoryPolicy || "continue",
          options: options,
          metafields: metafields
        }
      }
    });

    const result = await response.json();

    if (result.data.productVariantCreate.userErrors.length > 0) {
      return json({
        error: result.data.productVariantCreate.userErrors[0].message
      }, { status: 400 });
    }

    return json({
      success: true,
      variant: result.data.productVariantCreate.productVariant
    });

  } catch (error) {
    console.error("Error creating variant:", error);
    return json({ error: error.message }, { status: 500 });
  }
}

async function findOrCreateVariant(admin, data) {
  const { productId, title, price, options, sku } = data;

  // First, try to find existing variant
  const findResponse = await admin.graphql(`
    query($id: ID!) {
      product(id: $id) {
        variants(first: 100) {
          edges {
            node {
              id
              title
              selectedOptions {
                name
                value
              }
            }
          }
        }
      }
    }
  `, {
    variables: { id: productId }
  });

  const findResult = await findResponse.json();
  const variants = findResult.data.product.variants.edges;

  // Check if variant with same options exists
  const existingVariant = variants.find(v => {
    const variantOptions = v.node.selectedOptions;
    return options.every(opt =>
      variantOptions.some(vo =>
        vo.name === opt.name && vo.value === opt.value
      )
    );
  });

  if (existingVariant) {
    return json({ 
      success: true,
      variant: existingVariant.node, 
      created: false 
    });
  }

  // Variant doesn't exist, create it
  return await createProductVariant(admin, data);
}

// ==================== DRAFT ORDER OPERATIONS ====================

async function createDraftOrder(admin, data) {
  const {
    customerEmail,
    lineItems,
    note,
    tags,
    metafields,
    appliedDiscount
  } = data;

  try {
    const response = await admin.graphql(`
      mutation draftOrderCreate($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder {
            id
            name
            invoiceUrl
            totalPrice
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: {
        input: {
          email: customerEmail,
          lineItems: lineItems,
          note: note,
          tags: tags,
          metafields: metafields,
          appliedDiscount: appliedDiscount,
          useCustomerDefaultAddress: true
        }
      }
    });

    const result = await response.json();

    if (result.data.draftOrderCreate.userErrors.length > 0) {
      return json({
        error: result.data.draftOrderCreate.userErrors[0].message
      }, { status: 400 });
    }

    return json({
      success: true,
      draftOrder: result.data.draftOrderCreate.draftOrder
    });

  } catch (error) {
    console.error("Error creating draft order:", error);
    return json({ error: error.message }, { status: 500 });
  }
}

// ==================== PRODUCT QUERY OPERATIONS ====================

async function getProducts(admin) {
  try {
    const response = await admin.graphql(`
      query {
        products(first: 100) {
          edges {
            node {
              id
              title
              featuredImage {
                url
              }
              variants(first: 1) {
                edges {
                  node {
                    price
                  }
                }
              }
            }
          }
        }
      }
    `);

    const result = await response.json();

    const products = result.data.products.edges.map(edge => ({
      id: edge.node.id,
      title: edge.node.title,
      image: edge.node.featuredImage?.url,
      price: edge.node.variants.edges[0]?.node.price || "0"
    }));

    return json({ success: true, products });

  } catch (error) {
    console.error("Error fetching products:", error);
    return json({ error: error.message }, { status: 500 });
  }
}

async function getProductVariants(admin, productId) {
  try {
    const response = await admin.graphql(`
      query($id: ID!) {
        product(id: $id) {
          variants(first: 100) {
            edges {
              node {
                id
                title
                price
                sku
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
        }
      }
    `, {
      variables: { id: productId }
    });

    const result = await response.json();

    const variants = result.data.product.variants.edges.map(edge => ({
      id: edge.node.id,
      title: edge.node.title,
      price: edge.node.price,
      sku: edge.node.sku,
      options: edge.node.selectedOptions
    }));

    return json({ success: true, variants });

  } catch (error) {
    console.error("Error fetching variants:", error);
    return json({ error: error.message }, { status: 500 });
  }
}