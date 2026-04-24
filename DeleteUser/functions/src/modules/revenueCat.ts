const REVENUECAT_BASE_URL = "https://api.revenuecat.com/v1";

type RevenueCatSubscriberResponse = {
  subscriber?: {
    entitlements?: Record<
      string,
      {
        expires_date?: string | null;
      }
    >;
    subscriptions?: Record<
      string,
      {
        expires_date?: string | null;
      }
    >;
  };
};

export type RevenueCatPremiumCheckResult = {
  hasPremiumVigente: boolean;
  reason: "none" | "premium_vigente";
};

export type RevenueCatDeleteResult = {
  uid: string;
  deleted: boolean;
  simulated: boolean;
};

function isFutureDate(dateValue?: string | null): boolean | null {
  if (!dateValue) {
    return null;
  }

  const parsed = Date.parse(dateValue);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed > Date.now();
}

function buildHeaders(revenueCatSecretKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${revenueCatSecretKey}`,
    "Content-Type": "application/json",
  };
}

export async function checkRevenueCatPremium(
  revenueCatSecretKey: string,
  uid: string,
): Promise<RevenueCatPremiumCheckResult> {
  const encodedUid = encodeURIComponent(uid);
  const url = `${REVENUECAT_BASE_URL}/subscribers/${encodedUid}`;

  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(revenueCatSecretKey),
  });

  if (response.status === 404) {
    return {
      hasPremiumVigente: false,
      reason: "none",
    };
  }

  if (!response.ok) {
    throw new Error(`RevenueCat GET subscriber failed with status ${response.status}`);
  }

  const data = (await response.json()) as RevenueCatSubscriberResponse;
  const entitlements = data.subscriber?.entitlements ?? {};
  const subscriptions = data.subscriber?.subscriptions ?? {};

  const hasActiveEntitlement = Object.values(entitlements).some((entitlement) => {
    if (entitlement.expires_date == null) {
      return true;
    }

    const active = isFutureDate(entitlement.expires_date);
    if (active === null) {
      // Fail-safe: se a data vier inválida, bloqueia exclusao.
      return true;
    }

    return active;
  });

  const hasActiveSubscription = Object.values(subscriptions).some((subscription) => {
    const active = isFutureDate(subscription.expires_date);
    if (active === null) {
      // Fail-safe: sem expires_date confiável em subscription, considera vigente.
      return true;
    }

    return active;
  });

  const hasPremiumVigente = hasActiveEntitlement || hasActiveSubscription;

  return {
    hasPremiumVigente,
    reason: hasPremiumVigente ? "premium_vigente" : "none",
  };
}

export async function deleteRevenueCatSubscriber(
  revenueCatSecretKey: string,
  uid: string,
): Promise<RevenueCatDeleteResult> {
  const encodedUid = encodeURIComponent(uid);
  const url = `${REVENUECAT_BASE_URL}/subscribers/${encodedUid}`;

  // Modo teste: exclusao real no RevenueCat desabilitada.
  // const response = await fetch(url, {
  //   method: "DELETE",
  //   headers: buildHeaders(revenueCatSecretKey),
  // });
  // if (!response.ok) {
  //   throw new Error(`RevenueCat DELETE subscriber failed with status ${response.status}`);
  // }

  void revenueCatSecretKey;
  void url;

  return {
    uid,
    deleted: false,
    simulated: true,
  };
}
