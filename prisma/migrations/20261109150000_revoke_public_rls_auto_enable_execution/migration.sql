-- Supabase's event-trigger helper runs as SECURITY DEFINER and should never
-- be executable through the public PostgREST API roles.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
