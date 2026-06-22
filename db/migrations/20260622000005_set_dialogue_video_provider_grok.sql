-- Dialogue lines should use browser/Grok generation by default.
-- Non-dialogue lines keep the column default/fallback of ltx_2_3_flf2v unless explicitly changed.

update kazika_studio_agents.script_lines
set video_generation_provider = 'grok',
    updated_at = now()
where line_type = 'dialogue'
  and video_generation_provider <> 'grok';

create or replace function kazika_studio_agents.enforce_dialogue_video_generation_provider()
returns trigger
language plpgsql
as $$
begin
  if new.line_type = 'dialogue' then
    new.video_generation_provider := 'grok';
  end if;
  if new.video_generation_provider is null then
    new.video_generation_provider := 'ltx_2_3_flf2v';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_script_lines_dialogue_video_generation_provider
  on kazika_studio_agents.script_lines;

create trigger trg_script_lines_dialogue_video_generation_provider
before insert or update of line_type, video_generation_provider
on kazika_studio_agents.script_lines
for each row
execute function kazika_studio_agents.enforce_dialogue_video_generation_provider();
