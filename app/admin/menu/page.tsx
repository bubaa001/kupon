import { redirect } from 'next/navigation';

/**
 * Food is owned by the vendor. The university admin vets and suspends vendors,
 * not individual menu items, so the old menu-approval route is intentionally
 * retired and redirects to vendor management.
 */
export default function AdminMenuRedirectPage() {
  redirect('/admin/vendors');
}
