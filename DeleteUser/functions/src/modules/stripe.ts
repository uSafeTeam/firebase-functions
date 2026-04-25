const PREMIUM_PRODUCT_ID = "prod_SpfK85KEu9QO6F";
type StripeSubscription = {
  status: string;
  current_period_end: number;
  items: {
    data: Array<{
      price: {
        product: string | { id: string } | null;
      };
    }>;
  };
};

export type StripePremiumCheckResult = {
  hasPremiumVigente: boolean;
  customerId: string | null;
  reason: "none" | "premium_vigente";
};

export type StripeDeleteResult = {
  customerId: string;
  deleted: boolean;
  simulated: boolean;
};

function isPremiumProduct(priceProduct: string | { id: string } | null): boolean {
  if (!priceProduct) {
    return false;
  }

  if (typeof priceProduct === "string") {
    return priceProduct === PREMIUM_PRODUCT_ID;
  }

  return priceProduct.id === PREMIUM_PRODUCT_ID;
}

function isSubscriptionVigente(subscription: StripeSubscription): boolean {
  if (subscription.status === "active" || subscription.status === "trialing" || subscription.status === "past_due") {
    return true;
  }

  if (subscription.status === "canceled") {
    return false;
  }

  return false;
}

export async function checkStripePremium(
  stripeClient: any,
  uid: string,
): Promise<StripePremiumCheckResult> {
  const customers = await stripeClient.customers.search({
    query: `metadata['firebaseUID']:'${uid}'`,
    limit: 1,
  });

  const customer = customers.data[0];
  if (!customer) {
    return {
      hasPremiumVigente: false,
      customerId: null,
      reason: "none",
    };
  }

  const subscriptions = await stripeClient.subscriptions.list({
    customer: customer.id,
    status: "all",
    limit: 100,
  });

  const hasPremiumVigente = subscriptions.data.some((subscription: StripeSubscription) => {
    const hasPremiumItem = subscription.items.data.some((item) => {
      return isPremiumProduct(item.price.product ?? null);
    });

    if (!hasPremiumItem) {
      return false;
    }

    return isSubscriptionVigente(subscription);
  });

  return {
    hasPremiumVigente,
    customerId: customer.id,
    reason: hasPremiumVigente ? "premium_vigente" : "none",
  };
}

export async function deleteStripeCustomer(
  stripeClient: any,
  customerId: string,
): Promise<StripeDeleteResult> {
  await stripeClient.customers.del(customerId);

  void stripeClient;

  return {
    customerId,
    deleted: false,
    simulated: true,
  };
}
