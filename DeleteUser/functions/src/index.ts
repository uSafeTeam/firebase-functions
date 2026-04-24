/**
 * Import function triggers from their respective submodules:
 *
 * 
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { HttpsError, onCall } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import Stripe from "stripe";
import { checkStripePremium, deleteStripeCustomer } from "./modules/stripe.js";
import { checkRevenueCatPremium, deleteRevenueCatSubscriber } from "./modules/revenueCat.js";
import { deleteFirebaseAuth, deleteFirestoreUserData } from "./modules/firebase.js";

setGlobalOptions({ maxInstances: 2 });

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const REVENUECAT_SECRET_KEY = defineSecret("REVENUECAT_SECRET_KEY");

export const deleteUser = onCall({ secrets: [STRIPE_SECRET_KEY, REVENUECAT_SECRET_KEY] }, async (request) => {
    const uid = request.auth?.uid;
    const stripeSecretKey = STRIPE_SECRET_KEY.value();
    const revenueCatSecretKey = REVENUECAT_SECRET_KEY.value();

    if (!uid) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    if (!stripeSecretKey || !revenueCatSecretKey) {
        throw new HttpsError("failed-precondition", "Secrets ausentes no ambiente do container.", {
            errorCode: 2001,
            missingStripeSecret: !stripeSecretKey,
            missingRevenueCatSecret: !revenueCatSecretKey,
        });
    }

    const stripeClient = new Stripe(stripeSecretKey);

    const [stripeStatus, revenueCatStatus] = await Promise.all([
        checkStripePremium(stripeClient, uid),
        checkRevenueCatPremium(revenueCatSecretKey, uid),
    ]);

    if (stripeStatus.hasPremiumVigente || revenueCatStatus.hasPremiumVigente) {
        let errorCode = 1003;

        if (stripeStatus.hasPremiumVigente && !revenueCatStatus.hasPremiumVigente) {
            errorCode = 1001;
        } else if (!stripeStatus.hasPremiumVigente && revenueCatStatus.hasPremiumVigente) {
            errorCode = 1002;
        }

        throw new HttpsError(
            "failed-precondition",
            "Usuario possui premium vigente e nao pode ser excluido.",
            {
                errorCode,
                stripe: stripeStatus,
                revenueCat: revenueCatStatus,
            },
        );
    }

    const stripeDelete = stripeStatus.customerId
        ? await deleteStripeCustomer(stripeClient, stripeStatus.customerId)
        : {
            customerId: null,
            deleted: false,
            simulated: true,
        };

    const revenueCatDelete = await deleteRevenueCatSubscriber(revenueCatSecretKey, uid);
    const firebaseAuthDelete = await deleteFirebaseAuth(uid);
    const firestoreDelete = await deleteFirestoreUserData(uid);

    return {
        uid,
        testMode: true,
        checkedPremium: {
            stripe: stripeStatus,
            revenueCat: revenueCatStatus,
        },
        wouldDelete: {
            stripe: stripeDelete,
            revenueCat: revenueCatDelete,
            firebaseAuth: firebaseAuthDelete,
            firestore: firestoreDelete,
        },
    };
});
