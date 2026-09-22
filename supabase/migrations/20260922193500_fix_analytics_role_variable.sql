do $$
declare
  function_body text;
begin
  select procedure.prosrc into function_body
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'get_staff_analytics'
    and procedure.pronargs = 0;

  if function_body is null then
    raise exception 'get_staff_analytics() is missing';
  end if;

  function_body := replace(function_body, 'current_role', 'staff_role');
  execute format(
    'create or replace function public.get_staff_analytics() returns jsonb language plpgsql stable security definer set search_path = '''' as %L',
    function_body
  );
end;
$$;
