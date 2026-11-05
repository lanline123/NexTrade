import { redirect } from 'next/navigation';
export default function CategoryCatchAll() {
  redirect('/search');
}
