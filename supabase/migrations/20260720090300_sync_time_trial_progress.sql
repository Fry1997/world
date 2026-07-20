alter table public.user_state
  drop constraint user_state_namespace_check;

alter table public.user_state
  add constraint user_state_namespace_check
  check (namespace in ('solo', 'mastery', 'mastery_session', 'preferences', 'time_trial'));
