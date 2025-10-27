
import { KnowledgeBaseItem } from './types';
import { collection, getDocs, query, orderBy, getFirestore } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';

const db = getFirestore(firebaseApp);

export let knowledgeBaseItems: KnowledgeBaseItem[] = [
    {
        id: 'kb-1',
        question: 'What are your office hours?',
        answer: 'Our office hours are from 8:00 AM to 5:00 PM, Monday to Friday.'
    },
    {
        id: 'kb-2',
        question: 'What is the physical address of the company?',
        answer: 'Our physical address is 369 Oak Avenue, Ferndale, Randburg.'
    },
    {
        id: 'kb-3',
        question: 'What is your refund policy?',
        answer: 'All services are non-refundable once work has begun. Refunds may be considered only if the service has not yet started, and a processing fee of 10% will be deducted from any approved refund. Refund requests must be submitted within 48 hours of purchase.'
    }
];

// Function to fetch and update the knowledge base from Firestore
export async function fetchKnowledgeBase() {
    try {
        const q = query(collection(db, "knowledgeBase"), orderBy("question"));
        const querySnapshot = await getDocs(q);
        const fetchedItems = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KnowledgeBaseItem));
        knowledgeBaseItems = fetchedItems;
        return fetchedItems;
    } catch (error) {
        console.error("Error fetching knowledge base from Firestore:", error);
        // Return static data as a fallback
        return knowledgeBaseItems;
    }
}
