import admin from "firebase-admin";

export type FirebaseAuthDeleteResult = {
  uid: string;
  deleted: boolean;
  simulated: boolean;
};

export type FirestoreDeleteResult = {
  path: string;
  deleted: boolean;
  simulated: boolean;
};

if (!admin.apps.length) {
  admin.initializeApp();
}

export async function deleteFirebaseAuth(uid: string): Promise<FirebaseAuthDeleteResult> {
  await admin.auth().deleteUser(uid);

  return {
    uid,
    deleted: false,
    simulated: true,
  };
}

export async function deleteFirestoreUserData(uid: string): Promise<FirestoreDeleteResult[]> {
  const db = admin.firestore();
  const usersPath = `users/${uid}`;
  const customersPath = `customers/${uid}`;

  await db.recursiveDelete(db.doc(usersPath));
  await db.recursiveDelete(db.doc(customersPath));

  void db;

  return [
    {
      path: usersPath,
      deleted: false,
      simulated: true,
    },
    {
      path: customersPath,
      deleted: false,
      simulated: true,
    },
  ];
}
