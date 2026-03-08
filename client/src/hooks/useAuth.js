import { useEffect, useState } from "react";
import { auth } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export function useAuth() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      if (firebaseUser) {
        // Set up real-time listener for user document in Firestore
        const userDocRef = doc(db, "Users", firebaseUser.uid);
        const unsubscribeSnapshot = onSnapshot(userDocRef, (userDoc) => {
          if (userDoc.exists()) {
            const userData = { 
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: userDoc.data().role || "user",
              ...userDoc.data() 
            };
            setUser(userData);
          } else {
            setUser({ uid: firebaseUser.uid, email: firebaseUser.email, role: "user" });
          }
        }, (error) => {
          console.error("Error fetching user data:", error);
          setUser({ uid: firebaseUser.uid, email: firebaseUser.email, role: "user" });
        });
        return unsubscribeSnapshot;
      } else {
        setUser(null);
      }
    });
    return unsubscribe;
  }, []);

  return { user };
}