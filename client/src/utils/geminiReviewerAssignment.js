import { where } from 'firebase/firestore';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL = 'gemini-2.0-flash'; // updated model

export const assignReviewerWithGemini = async (contentItem, availableReviewers) => {
  try {
    if (!GEMINI_API_KEY) throw new Error('Missing VITE_GEMINI_API_KEY');

    const prompt = `
      You are a content review assignment system. Based on the following information, assign the most suitable reviewer.

      Content to Review:
      - Title: ${contentItem.title}
      - Type: ${contentItem.type || 'General'}
      - Category: ${contentItem.category || 'General'}

      Available Reviewers:
      ${availableReviewers.map(r => `- ${r.name} (ID: ${r.uid}, Expertise: ${r.expertise || 'General'}, Current Load: ${r.currentLoad}/5, Available: ${r.isAvailable ? 'Yes' : 'No'})`).join('\n')}

      Respond with ONLY: REVIEWER_UID:uid_value
    `;

    const response = await fetch(`${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errBody}`);
    }

    const data = await response.json();
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const uidMatch = responseText.match(/REVIEWER_UID:([a-zA-Z0-9_-]+)/);
    return uidMatch ? uidMatch[1] : null;
  } catch (error) {
    console.error('Error with Gemini API assignment:', error);
    return null;
  }
};

export const getAvailableReviewers = async (db, collection, query, getDocs) => {
  try {
    const q = query(collection(db, 'Users'), where('role', '==', 'reviewer'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching available reviewers:', error);
    return [];
  }
};