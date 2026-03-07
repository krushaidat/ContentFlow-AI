import { useEffect, useState } from "react";
import { auth } from "../firebase";
import { getDoc, doc } from "firebase/firestore";
import { db } from "../firebase";

export function useAuth() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, "Users", firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = { 
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: firebaseUser.role || userDoc.data().role || "user", // <-- Get role from Firestore or default to "user"
              ...userDoc.data() 
            };

            
            setUser(userData);
          } else {
            setUser({ uid: firebaseUser.uid, email: firebaseUser.email, role: "user" });
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setUser({ uid: firebaseUser.uid, email: firebaseUser.email, role: "user" });
        }
      } else {
        setUser(null);
      }
    });
    return unsubscribe;
  }, []);

  return { user };
}