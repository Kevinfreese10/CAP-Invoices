
'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  Query,
  DocumentData,
  QueryDocumentSnapshot,
  where,
  QueryConstraint,
} from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

const db = getFirestore(firebaseApp);

interface UsePaginatedFirestoreOptions {
  baseQuery: Query | null;
  pageSize?: number;
}

/**
 * A reusable hook for paginating Firestore queries.
 *
 * @param {UsePaginatedFirestoreOptions} options - The configuration for the hook.
 * @param {Query | null} options.baseQuery - The base Firestore query to paginate.
 * @param {number} [options.pageSize=50] - The number of documents to fetch per page.
 * @returns An object containing the documents, loading state, and pagination functions.
 */
export function usePaginatedFirestore<T>({
  baseQuery,
  pageSize = 50,
}: UsePaginatedFirestoreOptions) {
  const [documents, setDocuments] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const { toast } = useToast();

  const fetchInitial = useCallback(async () => {
    if (!baseQuery) {
      setDocuments([]);
      setIsLoading(false);
      setHasMore(false);
      return;
    };

    setIsLoading(true);
    setDocuments([]);
    setLastDoc(null);
    setHasMore(true);

    try {
      const firstPageQuery = query(baseQuery, limit(pageSize));
      const documentSnapshots = await getDocs(firstPageQuery);
      
      const newDocuments = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
      const lastVisible = documentSnapshots.docs[documentSnapshots.docs.length - 1];

      setDocuments(newDocuments);
      setLastDoc(lastVisible || null);
      setHasMore(documentSnapshots.docs.length === pageSize);

    } catch (error) {
      console.error("Error fetching initial documents:", error);
      toast({
        title: "Error",
        description: "Could not fetch initial data.",
        variant: "destructive",
      });
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [baseQuery, pageSize, toast]);


  const loadMore = useCallback(async () => {
    if (!baseQuery || !hasMore || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const nextQuery = query(baseQuery, startAfter(lastDoc), limit(pageSize));
      const documentSnapshots = await getDocs(nextQuery);

      const newDocuments = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
      const lastVisible = documentSnapshots.docs[documentSnapshots.docs.length - 1];

      setDocuments(prev => [...prev, ...newDocuments]);
      setLastDoc(lastVisible || null);
      setHasMore(documentSnapshots.docs.length === pageSize);

    } catch (error) {
      console.error("Error loading more documents:", error);
       toast({
        title: "Error",
        description: "Could not load more data.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [baseQuery, hasMore, isLoadingMore, lastDoc, pageSize, toast]);

  // Effect to re-fetch when the base query changes
  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  return { documents, isLoading, loadMore, hasMore, isLoadingMore, refetch: fetchInitial };
}
