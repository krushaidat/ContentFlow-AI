import {collection, addDoc, getDocs, doc, deleteDoc, updateDoc} from 'firebase/firestore'
import {db} from '../firebase/'

/** DRAVEN
 *Adds a new template to the Firestore database.
@param {String} templateTitle - The title of the template to be added.
@param {String} templateContent - The content of the template to be added.
@returns {Promise<String>} -The id of the newly added template document in the Firestore database.
*/
export const addTemplate = async (templateTitle, templateContent) => {
    try {
        const docRef = await addDoc(collection(db, 'templates'), {
            title: templateTitle,
            content: templateContent
        });
        return docRef.id;
    } catch (error) {
        console.error('Error adding template:', error);
        throw error;
    }
};

/** DRAVEN
 * Fetches all templates from the Firestore database.
 * @returns {Promise<Array>} - An array of template objects, each containing the id, title, and content of a template.
 */
export const fetchTemplates = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, 'templates'));
        const templates = [];
        querySnapshot.forEach((doc) => {
            templates.push({ id: doc.id, ...doc.data() });
        });
        return templates;
    } catch (error) {
        console.error('Error fetching templates:', error);
        throw error;
    }
};

/** DRAVEN
 * Deletes a template from the Firestore database based on the provided template ID.
 * @param {String} templateId - The ID of the template to be deleted.
 * @returns {Promise<void>} - A promise that resolves when the template is successfully deleted.
 */
export const deleteTemplate = async (templateId) => {
    try {
        await deleteDoc(doc(db, 'templates', templateId));
    } catch (error) {
        console.error('Error deleting template:', error);
        throw error;
    }
};

/** DRAVEN
 * Updates an existing template in the Firestore database.
 * @param {String} templateId - The ID of the template to update.
 * @param {String} templateTitle - The updated template title.
 * @param {String} templateContent - The updated template content.
 * @returns {Promise<void>} - A promise that resolves when the update completes.
 */
export const updateTemplate = async (templateId, templateTitle, templateContent) => {
    try {
        await updateDoc(doc(db, 'templates', templateId), {
            title: templateTitle,
            content: templateContent
        });
    } catch (error) {
        console.error('Error updating template:', error);
        throw error;
    }
};