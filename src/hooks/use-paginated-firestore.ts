
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
            setCurrentPage(page);
        } else {
            // If we're going forward and get no results, we're at the end.
            if(direction === 'next') {
                setPageCount(currentPage); // Lock the page count
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
      fetchPage(currentPage + 1, 'next');
  }
  
  const goToPreviousPage = () => {
      if (!firstDoc || currentPage === 1) return;
      fetchPage(currentPage - 1, 'prev');
  }

  // Initial fetch
  useEffect(() => {
    fetchPage(1, 'initial');
  }, [baseQuery]); // Re-run only when baseQuery changes
  
  // Simplified hook return
  return { 
      documents, 
      isLoading,
      goToNextPage,
      goToPreviousPage,
      currentPage,
      // A simple way to know if there could be a next/prev page
      canGoNext: documents.length === pageSize,
      canGoPrev: currentPage > 1,
      refetch: () => fetchPage(1, 'initial') 
    };
}
