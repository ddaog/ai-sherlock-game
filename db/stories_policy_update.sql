-- Harden existing stories table access after moving runtime reads behind server routes.

drop policy if exists "Everyone can view stories" on public.stories;

-- No public read policy. Runtime access should go through server routes or service_role.
