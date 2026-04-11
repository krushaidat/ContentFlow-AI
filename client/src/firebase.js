import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDNYV8rYI9D6SY9HIvXvXrWSysALDrp_ak",
  authDomain: "contentflow-ai-80993.firebaseapp.com",
  projectId: "contentflow-ai-80993",
};

const app = initializeApp(firebaseConfig); 
export const auth = getAuth(app);
export const db = getFirestore(app);