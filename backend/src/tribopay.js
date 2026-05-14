const axios = require("axios");

const baseURL =
  process.env.TRIBOPAY_API_BASE_URL || "https://api.tribopay.com.br/api/public/v1";

const triboClient = axios.create({
  baseURL,
  timeout: 15000,
});

async function resolveOfferAndProduct() {
  if (process.env.TRIBOPAY_OFFER_HASH && process.env.TRIBOPAY_PRODUCT_HASH) {
    return [
      {
        offerHash: process.env.TRIBOPAY_OFFER_HASH,
        productHash: process.env.TRIBOPAY_PRODUCT_HASH,
        productTitle: process.env.TRIBOPAY_PRODUCT_TITLE || "Pagamento InphoPay",
      },
    ];
  }

  const response = await triboClient.get("/products", {
    params: {
      api_token: process.env.TRIBOPAY_API_TOKEN,
      per_page: 100,
    },
  });

  const products = Array.isArray(response.data?.data) ? response.data.data : [];
  const candidates = [];

  for (const product of products) {
    const offers = Array.isArray(product?.offers) ? product.offers : [];
    for (const offer of offers) {
      if (!offer?.hash || !product?.hash) continue;
      candidates.push({
        offerHash: offer.hash,
        productHash: product.hash,
        productTitle: product.name || "Pagamento InphoPay",
      });
    }
  }

  if (candidates.length === 0) {
    throw new Error("Nenhuma oferta ativa encontrada na TriboPay.");
  }

  return candidates;
}

function extractTriboError(error) {
  const message =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    (typeof error?.response?.data === "string" ? error.response.data : null) ||
    error?.message ||
    "erro desconhecido";
  return String(message);
}

async function createPixWithCandidate({ amountCents, customer, candidate }) {
  const payload = {
    amount: amountCents,
    offer_hash: candidate.offerHash,
    payment_method: "pix",
    customer,
    cart: [
      {
        product_hash: candidate.productHash,
        title: candidate.productTitle,
        cover: null,
        price: amountCents,
        quantity: 1,
        operation_type: 1,
        tangible: false,
      },
    ],
    transaction_origin: "api",
  };

  const response = await triboClient.post("/transactions", payload, {
    params: { api_token: process.env.TRIBOPAY_API_TOKEN },
  });

  const pixQrCode = response.data?.pix?.pix_qr_code;
  const transactionId = response.data?.id || null;

  if (!pixQrCode) {
    throw new Error("TriboPay nao retornou pix_qr_code.");
  }

  return {
    pixQrCode,
    transactionId: transactionId ? String(transactionId) : null,
    offerHash: candidate.offerHash,
    productHash: candidate.productHash,
  };
}

async function createPixTransaction({ amountCents, customer }) {
  const candidates = await resolveOfferAndProduct();
  let lastError = "Falha na TriboPay.";

  for (const candidate of candidates) {
    try {
      const result = await createPixWithCandidate({ amountCents, customer, candidate });
      return result;
    } catch (error) {
      lastError = extractTriboError(error);
    }
  }

  throw new Error(lastError);
}

module.exports = { createPixTransaction };
