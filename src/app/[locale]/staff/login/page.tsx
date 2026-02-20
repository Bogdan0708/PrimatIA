import { redirect } from 'next/navigation';

export default function StaffLoginPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  redirect(`/${locale}/login`);
}
