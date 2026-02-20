import { redirect } from 'next/navigation';

export default function AutentificarePage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  redirect(`/${locale}/login`);
}
