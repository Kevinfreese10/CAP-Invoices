
'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  getFirestore,
  query,
  limit,
  startAfter,
  getDocs,
  Query,
  QueryDocumentSnapshot,
  endBefore,
  limitToLast,
} from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

const db = getFirestore(firebaseApp);

interface UsePaginatedFirestoreOptions {
  baseQuery: Query | null;
  pageSize?: number;
}

export function usePaginatedFirestore<T>({
  baseQuery,
  pageSize = 50,
}: UsePaginatedFirestoreOptions) {
  const [documents, setDocuments] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [firstDoc, setFirstDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(1); // Assume at least one page
  const { toast } = useToast();

  const fetchPage = useCallback(async (page: number, direction: 'next' | 'prev' | 'initial' = 'initial') => {
    if (!baseQuery) {
      setDocuments([]);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);

    try {
        let pageQuery;
        if (direction === 'next' && lastDoc) {
            pageQuery = query(baseQuery, startAfter(lastDoc), limit(pageSize));
        } else if (direction === 'prev' && firstDoc) {
            pageQuery = query(baseQuery, endBefore(firstDoc), limitToLast(pageSize));
        } else { // initial or jumping to a page (not implemented, but good to have)
            pageQuery = query(baseQuery, limit(pageSize));
        }

        const documentSnapshots = await getDocs(pageQuery);
        const newDocuments = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));

        if (!documentSnapshots.empty) {
            setDocuments(newDocuments);
            setFirstDoc(documentSnapshots.docs[0]);
            setLastDoc(documentSnapshots.docs[documentSnapshots.docs.length - 1]);
            if (direction !== 'initial') {
                setCurrentPage(page);
            }
        } else {
             if(direction === 'next') {
                setPageCount(currentPage); // Lock the page count
            } else if (direction === 'prev') {
                // If we go back and get nothing, something is wrong, or we are at the start
                // Do nothing, stay on the current page
            } else { // initial fetch returned no docs
                setDocuments([]);
                setFirstDoc(null);
                setLastDoc(null);
            }
        }
    } catch (error) {
       console.error("Error fetching documents:", error);
       toast({
        title: "Error",
        description: "Could not fetch data.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }

  }, [baseQuery, pageSize, toast, lastDoc, firstDoc, currentPage]);

  const goToNextPage = () => {
      if (!lastDoc) return;
      fetchPage(currentPage + 1, 'next').then(() => setCurrentPage(prev => prev + 1));
  }
  
  const goToPreviousPage = () => {
      if (!firstDoc || currentPage === 1) return;
      fetchPage(currentPage - 1, 'prev').then(() => setCurrentPage(prev => prev - 1));
  }
  
  const refetch = useCallback(() => {
    setCurrentPage(1);
    setLastDoc(null);
    setFirstDoc(null);
    if (baseQuery) {
        const initialQuery = query(baseQuery, limit(pageSize));
        setIsLoading(true);
        getDocs(initialQuery).then(documentSnapshots => {
            const newDocuments = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
            setDocuments(newDocuments);
            if (!documentSnapshots.empty) {
                setFirstDoc(documentSnapshots.docs[0]);
                setLastDoc(documentSnapshots.docs[documentSnapshots.docs.length - 1]);
            } else {
                setFirstDoc(null);
                setLastDoc(null);
            }
            setIsLoading(false);
        }).catch(error => {
            console.error("Error refetching documents:", error);
            toast({
                title: "Error",
                description: "Could not refresh data.",
                variant: "destructive",
            });
            setIsLoading(false);
        });
    }
  }, [baseQuery, pageSize, toast]);


  // Initial fetch effect
  useEffect(() => {
    refetch();
  }, [baseQuery]);
  
  return { 
      documents, 
      isLoading,
      goToNextPage,
      goToPreviousPage,
      currentPage,
      canGoNext: documents.length === pageSize,
      canGoPrev: currentPage > 1,
      refetch
    };
}
