
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { BlogPost } from '@/lib/types';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { format } from 'date-fns';

const db = getFirestore(firebaseApp);

async function getPost(slug: string): Promise<BlogPost | null> {
    const q = query(collection(db, "blogPosts"), where("slug", "==", slug));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        return null;
    }
    const docData = querySnapshot.docs[0].data();
    return {
        ...docData,
        id: querySnapshot.docs[0].id,
        date: docData.date.toDate().toISOString(),
    } as BlogPost;
}

export async function generateStaticParams() {
    const snapshot = await getDocs(collection(db, 'blogPosts'));
    return snapshot.docs.map(doc => ({
        slug: doc.data().slug,
    }));
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);

  if (!post) {
    notFound();
  }

  return (
    <article className="container mx-auto max-w-4xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{post.title}</h1>
        <div className="mt-6 flex items-center gap-4">
          <div>
            <p className="font-semibold">{post.author}</p>
            <p className="text-sm text-muted-foreground">
              Published on {format(new Date(post.date), 'dd MMMM yyyy')}
            </p>
          </div>
        </div>
      </header>
      
      <div className="relative my-8 h-64 md:h-96 w-full">
        <Image
          src={post.imageUrl}
          alt={post.title}
          fill
          className="rounded-lg object-cover shadow-lg"
          data-ai-hint={post.imageHint}
        />
      </div>

      <div
        className="prose prose-lg max-w-none prose-h3:font-headline prose-h3:text-xl prose-h3:font-semibold prose-p:text-foreground/80 prose-a:text-primary"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />
    </article>
  );
}
