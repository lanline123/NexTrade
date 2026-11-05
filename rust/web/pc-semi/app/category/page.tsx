import { redirect } from 'next/navigation';

interface CategoryPageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

export default function CategoryPage({ searchParams }: CategoryPageProps) {
  const raw = searchParams?.categoryId;
  const categoryId = Array.isArray(raw) ? raw[0] : raw;
  redirect(categoryId ? `/search?categoryId=${encodeURIComponent(categoryId)}` : '/search');
}
