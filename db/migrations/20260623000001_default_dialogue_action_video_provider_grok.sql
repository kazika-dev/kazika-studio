-- Dialogue/action lines default to Grok, but explicit LTX remains allowed.
-- Other line types keep LTX as the fallback when no provider is supplied.

alter table kazika_studio_agents.script_lines
  alter column video_generation_provider drop default;

update kazika_studio_agents.script_lines
set video_generation_provider = 'grok',
    updated_at = now()
where line_type in ('dialogue', 'action')
  and video_generation_provider <> 'grok';

create or replace function kazika_studio_agents.enforce_dialogue_video_generation_provider()
returns trigger
language plpgsql
as $$
begin
  if new.video_generation_provider is null or new.video_generation_provider = '' then
    if new.line_type in ('dialogue', 'action') then
      new.video_generation_provider := 'grok';
    else
      new.video_generation_provider := 'ltx_2_3_flf2v';
    end if;
  end if;
  return new;
end;
$$;
