import { redirect } from 'next/navigation';
export default function ProductCatchAll() {
  redirect('/search');
}
